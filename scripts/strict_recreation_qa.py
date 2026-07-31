#!/usr/bin/env python3
"""Strict visual and structural QA for 1-to-1 paper-figure recreations."""

from __future__ import annotations

import argparse
import glob
import json
import math
import os
import re
import shutil
import subprocess
import tempfile
import unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZipFile

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFont


NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
}


def normalize_text(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).lower()
    return re.sub(r"[\s\-–—·•:;,.!?()（）\[\]{}]+", "", value)


def resolve_tool(name: str, explicit: str | None = None) -> str:
    if explicit:
        return explicit
    found = shutil.which(name)
    if found:
        return found
    raise RuntimeError(f"Required executable not found: {name}")


def render_reference(reference: Path, output_png: Path, width: int, pdftoppm: str) -> None:
    if reference.suffix.lower() == ".pdf":
        # Pillow cannot reliably rasterize PDFs in the bundled runtime. Derive
        # the aspect ratio from pdfinfo when available, then use pdftoppm.
        info = subprocess.run(
            ["pdfinfo", str(reference)],
            check=True,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        ).stdout
        match = re.search(r"Page size:\s+([\d.]+)\s+x\s+([\d.]+)", info)
        if not match:
            raise RuntimeError(f"Cannot determine PDF page size: {reference}")
        page_w, page_h = float(match.group(1)), float(match.group(2))
        height = max(1, round(width * page_h / page_w))
        prefix = output_png.with_suffix("")
        subprocess.run(
            [pdftoppm, "-png", "-f", "1", "-singlefile", "-scale-to-x", str(width),
             "-scale-to-y", str(height), str(reference), str(prefix)],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
        return
    image = Image.open(reference).convert("RGB")
    height = max(1, round(width * image.height / image.width))
    image.resize((width, height), Image.Resampling.LANCZOS).save(output_png)


def find_artifact_renderer(explicit: str | None = None) -> str | None:
    if explicit:
        return explicit
    candidates = sorted(
        glob.glob(
            str(
                Path.home()
                / ".codex/plugins/cache/openai-primary-runtime/presentations/*/"
                "skills/presentations/container_tools/render_presentation.mjs"
            )
        ),
        reverse=True,
    )
    return candidates[0] if candidates else None


def render_pptx(
    pptx: Path,
    output_png: Path,
    width: int,
    artifact_renderer: str | None,
    soffice: str | None,
    pdftoppm: str,
) -> None:
    if artifact_renderer:
        with tempfile.TemporaryDirectory(prefix="strict-recreation-artifact-") as temp:
            temp_dir = Path(temp)
            with ZipFile(pptx) as archive:
                presentation = ET.fromstring(archive.read("ppt/presentation.xml"))
            size = presentation.find("./p:sldSz", NS)
            slide_width_inches = int(size.get("cx")) / 914400 if size is not None else 10
            scale = width / max(1, slide_width_inches * 96)
            subprocess.run(
                [
                    resolve_tool("node"),
                    artifact_renderer,
                    "--input",
                    str(pptx),
                    "--output_dir",
                    str(temp_dir),
                    "--scale",
                    f"{scale:.6f}",
                    "--workspace",
                    str(temp_dir / "workspace"),
                ],
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            rendered = temp_dir / "slide-1.png"
            if not rendered.exists():
                raise RuntimeError(f"Artifact renderer did not create {rendered}")
            shutil.copyfile(rendered, output_png)
        return
    if not soffice:
        raise RuntimeError(
            "No Artifact Tool slide renderer was found and LibreOffice fallback is unavailable."
        )
    with tempfile.TemporaryDirectory(prefix="strict-recreation-pptx-") as temp:
        temp_dir = Path(temp)
        subprocess.run(
            [soffice, "--headless", "--convert-to", "pdf", "--outdir", str(temp_dir), str(pptx)],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        pdf = temp_dir / f"{pptx.stem}.pdf"
        if not pdf.exists():
            raise RuntimeError(f"LibreOffice did not create {pdf}")
        prefix = output_png.with_suffix("")
        subprocess.run(
            [pdftoppm, "-png", "-f", "1", "-singlefile", "-scale-to-x", str(width),
             "-scale-to-y", "-1", str(pdf), str(prefix)],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )


def white_rgb(path: Path) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    background = Image.new("RGBA", image.size, "white")
    return Image.alpha_composite(background, image).convert("RGB")


def foreground_mask(array: np.ndarray, white_threshold: float) -> np.ndarray:
    return array.mean(axis=2) < white_threshold


def edge_mask(array: np.ndarray, threshold: float) -> np.ndarray:
    gray = array.mean(axis=2)
    dx = np.abs(gray[:, 1:] - gray[:, :-1])
    dy = np.abs(gray[1:, :] - gray[:-1, :])
    edges = np.zeros_like(gray, dtype=bool)
    edges[:, 1:] |= dx > threshold
    edges[:, :-1] |= dx > threshold
    edges[1:, :] |= dy > threshold
    edges[:-1, :] |= dy > threshold
    return edges


def iou(left: np.ndarray, right: np.ndarray) -> float:
    union = np.logical_or(left, right).sum()
    return float(np.logical_and(left, right).sum() / union) if union else 1.0


def dilate_mask(mask: np.ndarray, radius: int) -> np.ndarray:
    """Dilate a boolean mask without adding a scipy dependency."""
    if radius <= 0:
        return mask.copy()
    height, width = mask.shape
    dilated = np.zeros_like(mask)
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            if dx * dx + dy * dy > radius * radius:
                continue
            source_y0 = max(0, -dy)
            source_y1 = min(height, height - dy)
            source_x0 = max(0, -dx)
            source_x1 = min(width, width - dx)
            target_y0 = source_y0 + dy
            target_y1 = source_y1 + dy
            target_x0 = source_x0 + dx
            target_x1 = source_x1 + dx
            dilated[target_y0:target_y1, target_x0:target_x1] |= mask[
                source_y0:source_y1,
                source_x0:source_x1,
            ]
    return dilated


def line_mask(array: np.ndarray, dark_threshold: float, max_chroma: float) -> np.ndarray:
    """Keep neutral dark strokes while rejecting colored nodes and images."""
    gray = array.mean(axis=2)
    chroma = array.max(axis=2) - array.min(axis=2)
    return np.logical_and(gray <= dark_threshold, chroma <= max_chroma)


def tolerant_line_scores(reference: np.ndarray, recreation: np.ndarray, radius: int) -> dict:
    reference_count = int(reference.sum())
    recreation_count = int(recreation.sum())
    if not reference_count and not recreation_count:
        return {"precision": 1.0, "recall": 1.0, "f1": 1.0, "reference_pixels": 0, "recreation_pixels": 0}
    precision = (
        float(np.logical_and(recreation, dilate_mask(reference, radius)).sum() / recreation_count)
        if recreation_count
        else 0.0
    )
    recall = (
        float(np.logical_and(reference, dilate_mask(recreation, radius)).sum() / reference_count)
        if reference_count
        else 0.0
    )
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "reference_pixels": reference_count,
        "recreation_pixels": recreation_count,
    }


def evaluate_line_gate(reference: np.ndarray, recreation: np.ndarray, config: dict) -> dict:
    """Measure dark line fidelity only inside declared diagram regions."""
    coordinate_space = config.get("coordinate_space", {})
    source_width = float(coordinate_space.get("width", reference.shape[1]))
    source_height = float(coordinate_space.get("height", reference.shape[0]))
    scale_x = reference.shape[1] / source_width
    scale_y = reference.shape[0] / source_height
    dark_threshold = float(config.get("dark_threshold", 0.62))
    max_chroma = float(config.get("max_chroma", 0.16))
    radius = int(config.get("tolerance_px", 2))
    regions = []
    for index, region in enumerate(config.get("regions", [])):
        left = max(0, round(float(region["left"]) * scale_x))
        top = max(0, round(float(region["top"]) * scale_y))
        right = min(reference.shape[1], round((float(region["left"]) + float(region["width"])) * scale_x))
        bottom = min(reference.shape[0], round((float(region["top"]) + float(region["height"])) * scale_y))
        reference_mask = line_mask(reference[top:bottom, left:right], dark_threshold, max_chroma)
        recreation_mask = line_mask(recreation[top:bottom, left:right], dark_threshold, max_chroma)
        score = tolerant_line_scores(reference_mask, recreation_mask, radius)
        score.update({"name": region.get("name", f"region-{index + 1}"), "bounds": [left, top, right, bottom]})
        regions.append(score)
    if not regions:
        raise RuntimeError("line_gate requires at least one region")
    reference_count = sum(item["reference_pixels"] for item in regions)
    recreation_count = sum(item["recreation_pixels"] for item in regions)
    precision = (
        sum(item["precision"] * item["recreation_pixels"] for item in regions) / recreation_count
        if recreation_count
        else (1.0 if not reference_count else 0.0)
    )
    recall = (
        sum(item["recall"] * item["reference_pixels"] for item in regions) / reference_count
        if reference_count
        else (1.0 if not recreation_count else 0.0)
    )
    aggregate = {
        "precision": precision,
        "recall": recall,
        "f1": 2 * precision * recall / (precision + recall) if precision + recall else 0.0,
        "reference_pixels": reference_count,
        "recreation_pixels": recreation_count,
    }
    aggregate["regions"] = regions
    aggregate["tolerance_px"] = radius
    aggregate["dark_threshold"] = dark_threshold
    aggregate["max_chroma"] = max_chroma
    return aggregate


def inspect_pptx(pptx: Path) -> dict:
    with ZipFile(pptx) as archive:
        presentation = ET.fromstring(archive.read("ppt/presentation.xml"))
        size = presentation.find("./p:sldSz", NS)
        slide_w = int(size.get("cx")) if size is not None else 1
        slide_h = int(size.get("cy")) if size is not None else 1
        slide = ET.fromstring(archive.read("ppt/slides/slide1.xml"))

    texts = [node.text or "" for node in slide.findall(".//a:t", NS)]
    object_count = sum(
        len(slide.findall(f".//p:{tag}", NS))
        for tag in ("sp", "pic", "cxnSp", "graphicFrame")
    )
    line_shape_count = sum(
        1
        for item in slide.findall(".//p:sp", NS)
        if (geometry := item.find("./p:spPr/a:prstGeom", NS)) is not None
        and geometry.get("prst") == "line"
    )
    line_object_count = line_shape_count + len(slide.findall(".//p:cxnSp", NS))
    pictures = slide.findall(".//p:pic", NS)
    full_canvas_pictures = []
    for picture in pictures:
        name_node = picture.find("./p:nvPicPr/p:cNvPr", NS)
        xfrm = picture.find("./p:spPr/a:xfrm", NS)
        if xfrm is None:
            continue
        ext = xfrm.find("./a:ext", NS)
        if ext is None:
            continue
        coverage = (int(ext.get("cx")) * int(ext.get("cy"))) / (slide_w * slide_h)
        if coverage >= 0.80:
            full_canvas_pictures.append(
                {"name": name_node.get("name", "") if name_node is not None else "", "coverage": coverage}
            )
    return {
        "text": "\n".join(texts),
        "object_count": object_count,
        "line_object_count": line_object_count,
        "picture_count": len(pictures),
        "full_canvas_pictures": full_canvas_pictures,
    }


def make_outputs(reference: Image.Image, recreation: Image.Image, output_dir: Path, case_id: str) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    ref_path = output_dir / f"{case_id}-reference.png"
    rec_path = output_dir / f"{case_id}-recreation.png"
    overlay_path = output_dir / f"{case_id}-overlay.png"
    diff_path = output_dir / f"{case_id}-diff.png"
    comparison_path = output_dir / f"{case_id}-comparison.png"
    reference.save(ref_path)
    recreation.save(rec_path)
    Image.blend(reference, recreation, 0.5).save(overlay_path)

    diff = ImageChops.difference(reference, recreation).convert("L")
    enhanced = diff.point(lambda value: min(255, value * 4))
    heat = Image.new("RGB", diff.size, "white")
    heat.paste((236, 32, 46), mask=enhanced)
    heat.save(diff_path)

    gutter = 24
    label_h = 52
    canvas = Image.new("RGB", (reference.width * 2 + gutter, reference.height + label_h), "white")
    canvas.paste(reference, (0, label_h))
    canvas.paste(recreation, (reference.width + gutter, label_h))
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default(size=26)
    draw.text((16, 12), "REFERENCE", fill="#111827", font=font)
    draw.text((reference.width + gutter + 16, 12), "RECREATION", fill="#111827", font=font)
    canvas.save(comparison_path)
    return {
        "reference": str(ref_path),
        "recreation": str(rec_path),
        "overlay": str(overlay_path),
        "difference": str(diff_path),
        "comparison": str(comparison_path),
    }


def evaluate_case(
    spec_path: Path,
    out_root: Path,
    artifact_renderer: str | None,
    soffice: str | None,
    pdftoppm: str,
) -> tuple[dict, bool]:
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    base = spec_path.parent
    reference_path = (base / spec["reference"]).resolve()
    recreation_path = (base / spec["recreation"]).resolve()
    width = int(spec.get("render_width", 1350))
    thresholds = spec["thresholds"]
    crop = {
        "left": 0.0,
        "top": 0.0,
        "right": 0.0,
        "bottom": 0.0,
        **spec.get("reference_crop", {}),
    }

    with tempfile.TemporaryDirectory(prefix="strict-recreation-qa-") as temp:
        temp_dir = Path(temp)
        reference_png = temp_dir / "reference.png"
        recreation_png = temp_dir / "recreation.png"
        full_reference_width = round(width / max(0.01, 1 - crop["left"] - crop["right"]))
        render_reference(reference_path, reference_png, full_reference_width, pdftoppm)
        render_pptx(
            recreation_path,
            recreation_png,
            width,
            artifact_renderer,
            soffice,
            pdftoppm,
        )
        reference = white_rgb(reference_png)
        recreation = white_rgb(recreation_png)
        if any(crop.values()):
            box = (
                round(reference.width * crop["left"]),
                round(reference.height * crop["top"]),
                round(reference.width * (1 - crop["right"])),
                round(reference.height * (1 - crop["bottom"])),
            )
            reference = reference.crop(box)
            reference_height = max(1, round(width * reference.height / reference.width))
            reference = reference.resize((width, reference_height), Image.Resampling.LANCZOS)
        if recreation.size != reference.size:
            recreation = recreation.resize(reference.size, Image.Resampling.LANCZOS)

    left = np.asarray(reference).astype(np.float32) / 255.0
    right = np.asarray(recreation).astype(np.float32) / 255.0
    absolute = np.abs(left - right)
    mae = float(absolute.mean())
    rmse = float(math.sqrt(np.square(left - right).mean()))
    foreground_iou = iou(
        foreground_mask(left, float(spec.get("white_threshold", 0.97))),
        foreground_mask(right, float(spec.get("white_threshold", 0.97))),
    )
    edge_iou = iou(
        edge_mask(left, float(spec.get("edge_threshold", 0.08))),
        edge_mask(right, float(spec.get("edge_threshold", 0.08))),
    )
    line_gate = evaluate_line_gate(left, right, spec["line_gate"]) if spec.get("line_gate") else None

    structure = inspect_pptx(recreation_path)
    normalized_deck_text = normalize_text(structure["text"])
    expected_texts = spec.get("expected_texts", [])
    matched_texts = [text for text in expected_texts if normalize_text(text) in normalized_deck_text]
    text_coverage = len(matched_texts) / len(expected_texts) if expected_texts else 1.0

    metrics = {
        "mae": mae,
        "rmse": rmse,
        "pixel_similarity": 1.0 - mae,
        "foreground_iou": foreground_iou,
        "edge_iou": edge_iou,
        "text_coverage": text_coverage,
        "object_count": structure["object_count"],
        "line_object_count": structure["line_object_count"],
        "picture_count": structure["picture_count"],
        "full_canvas_picture_count": len(structure["full_canvas_pictures"]),
    }
    if line_gate:
        metrics.update(
            {
                "line_precision": line_gate["precision"],
                "line_recall": line_gate["recall"],
                "line_f1": line_gate["f1"],
                "line_regions": line_gate["regions"],
            }
        )
    checks = {
        "mae": mae <= float(thresholds["max_mae"]),
        "foreground_iou": foreground_iou >= float(thresholds["min_foreground_iou"]),
        "edge_iou": edge_iou >= float(thresholds["min_edge_iou"]),
        "text_coverage": text_coverage >= float(thresholds["min_text_coverage"]),
        "object_count": structure["object_count"] >= int(thresholds["min_object_count"]),
        "no_full_canvas_picture": not structure["full_canvas_pictures"],
    }
    if line_gate:
        checks["line_f1"] = line_gate["f1"] >= float(thresholds["min_line_f1"])
    if "expected_line_object_count" in spec:
        checks["line_object_count"] = structure["line_object_count"] == int(spec["expected_line_object_count"])
    case_out = out_root / spec["id"]
    artifacts = make_outputs(reference, recreation, case_out, spec["id"])
    report = {
        "id": spec["id"],
        "paper": spec["paper"],
        "figure": spec["figure"],
        "reference": str(reference_path),
        "recreation": str(recreation_path),
        "metrics": metrics,
        "thresholds": thresholds,
        "checks": checks,
        "missing_expected_texts": [text for text in expected_texts if text not in matched_texts],
        "full_canvas_pictures": structure["full_canvas_pictures"],
        "artifacts": artifacts,
        "passed": all(checks.values()),
    }
    case_out.mkdir(parents=True, exist_ok=True)
    (case_out / "report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return report, report["passed"]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", default="benchmark/strict/manifest.json")
    parser.add_argument("--out", default="docs/strict-recreation")
    parser.add_argument("--case", help="Run one case id without overwriting the full summary.")
    parser.add_argument("--artifact-renderer", default=os.environ.get("ARTIFACT_RENDERER"))
    parser.add_argument("--soffice", default=os.environ.get("SOFFICE"))
    parser.add_argument("--pdftoppm", default=os.environ.get("PDFTOPPM"))
    args = parser.parse_args()

    manifest_path = Path(args.manifest).resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    out_root = Path(args.out).resolve()
    artifact_renderer = find_artifact_renderer(args.artifact_renderer)
    soffice = shutil.which("soffice") if not artifact_renderer else None
    if args.soffice:
        soffice = args.soffice
    pdftoppm = resolve_tool("pdftoppm", args.pdftoppm)

    reports = []
    passed = True
    case_files = manifest["cases"]
    if args.case:
        case_files = [
            relative
            for relative in case_files
            if Path(relative).stem == args.case
        ]
        if not case_files:
            raise RuntimeError(f"Case not found in manifest: {args.case}")
    for relative in case_files:
        report, case_passed = evaluate_case(
            (manifest_path.parent / relative).resolve(),
            out_root,
            artifact_renderer,
            soffice,
            pdftoppm,
        )
        reports.append(report)
        passed &= case_passed
        status = "PASS" if case_passed else "FAIL"
        metrics = report["metrics"]
        line_summary = f", line_f1={metrics['line_f1']:.4f}" if "line_f1" in metrics else ""
        print(
            f"{status} {report['id']}: similarity={metrics['pixel_similarity']:.4f}, "
            f"fg_iou={metrics['foreground_iou']:.4f}, edge_iou={metrics['edge_iou']:.4f}, "
            f"text={metrics['text_coverage']:.3f}, objects={metrics['object_count']}{line_summary}"
        )

    if not args.case:
        summary = {"passed": passed, "cases": reports}
        out_root.mkdir(parents=True, exist_ok=True)
        (out_root / "summary.json").write_text(
            json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
