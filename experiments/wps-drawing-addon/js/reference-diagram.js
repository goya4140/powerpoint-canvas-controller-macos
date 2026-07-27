/* global Application */

(() => {
  const PREFIX = "wps_reference_";
  const C = {
    ink: rgb(10, 15, 25),
    navy: rgb(21, 49, 91),
    paleBlue: rgb(224, 232, 249),
    panelBlue: rgb(235, 241, 252),
    gray: rgb(230, 234, 241),
    rose: rgb(238, 224, 228),
    mint: rgb(229, 240, 231),
    teal: rgb(27, 145, 139),
    red: rgb(245, 72, 85),
    purple: rgb(176, 126, 210),
    purpleLight: rgb(231, 211, 244),
    peach: rgb(250, 239, 232),
    orange: rgb(255, 122, 20),
    yellow: rgb(255, 194, 48),
    white: rgb(255, 255, 255),
  };

  function drawWpsReferenceDiagram(allowAnyPresentation) {
    const presentation = Application.ActivePresentation;
    if (!presentation || presentation.Slides.Count < 1) {
      throw new Error("WPS 演示中没有可绘制的幻灯片。");
    }
    if (!allowAnyPresentation && presentation.Name !== "wps-reference-recreation.pptx") {
      throw new Error(`等待论文图测试文稿，当前为：${presentation.Name}`);
    }

    const slide = presentation.Slides.Item(1);
    const shapes = slide.Shapes;
    preserveReferencePhotos(shapes);

    addFlowConnectors(shapes);
    addStageHeaders(shapes);
    addStageOne(shapes);
    addStageTwo(shapes);
    addReasoningPanels(shapes);
    addBottomRewards(shapes);

    presentation.Save();
    return {
      presentation: presentation.Name,
      slide_index: 1,
      shape_count: shapes.Count,
      created: [
        `${PREFIX}stage1_title`,
        `${PREFIX}stage2_title`,
        `${PREFIX}caption_box`,
        `${PREFIX}reward_box`,
        `${PREFIX}cot1_reasoning`,
        `${PREFIX}cot2_reasoning`,
        `${PREFIX}bottom_logic`,
      ],
    };
  }

  function addFlowConnectors(shapes) {
    line(shapes, "divider", 288, 10, 288, 382, C.ink, 1.8, false, true);

    arrow(shapes, "left_user_to_llm", 82, 272, 82, 231, C.ink, 2);
    arrow(shapes, "left_image_to_encoder", 220, 278, 220, 262, C.ink, 2);
    arrow(shapes, "left_encoder_to_llm", 220, 244, 220, 229, C.ink, 2);
    doubleArrow(shapes, "ar_loss", 146, 138, 146, 167, C.ink, 1.7);

    line(shapes, "policy_horizontal", 282, 188, 301, 188, C.ink, 2);
    line(shapes, "policy_vertical", 301, 188, 301, 64, C.ink, 2);
    arrow(shapes, "policy_into_reward", 301, 64, 311, 64, C.ink, 2);

    arrow(shapes, "right_user_to_llm", 374, 272, 374, 231, C.ink, 2);
    arrow(shapes, "right_image_to_encoder", 516, 278, 516, 262, C.ink, 2);
    arrow(shapes, "right_encoder_to_llm", 516, 244, 516, 229, C.ink, 2);
    arrow(shapes, "llm_to_cot", 448, 167, 448, 150, C.ink, 2);
    arrow(shapes, "cot_to_reward", 448, 103, 448, 84, C.ink, 2);

  }

  function addStageHeaders(shapes) {
    text(shapes, "stage1_title", 22, 9, 260, 29, "Stage1 SFT: Cold Start", 17, C.ink, true);
    text(shapes, "stage2_title", 316, 9, 280, 29, "Stage2 GRPO:  Critical Thinking", 17, C.ink, true);
  }

  function addStageOne(shapes) {
    rect(shapes, "caption_box", 14, 43, 267, 93, C.white, C.ink, 1.7, true, 0);
    text(shapes, "caption_label", 18, 47, 125, 22, "Caption Rewrite", 12.5, C.ink, true);
    roundRect(shapes, "caption_fake_real", 21, 67, 116, 52, rgb(222, 231, 250), rgb(149, 173, 221), 1.2);
    text(shapes, "caption_fake_real_text", 32, 77, 90, 36, "Fake / Real\nExplanation", 12.5, C.ink, false, "left");

    roundRect(shapes, "caption_qna", 161, 49, 112, 35, C.gray, C.gray, 0.5);
    text(shapes, "caption_qna_text", 173, 59, 89, 20, "Q&A Format", 13, C.ink, false);
    roundRect(shapes, "caption_multi", 161, 87, 112, 41, C.gray, C.gray, 0.5);
    text(shapes, "caption_multi_text", 173, 92, 88, 32, "Multi-turn\nDialogue", 12.5, C.ink, false, "center");
    text(shapes, "caption_cycle", 105, 58, 57, 61, "🔁\n🤖", 21, C.teal, false, "center");
    text(shapes, "ar_loss_text", 78, 140, 86, 22, "AR Loss", 13.5, C.ink, true, "center");

    modelBar(shapes, "left_llm", 14, 167, 267, "Large Language Model");
    tokenStrip(shapes, "left_tokens", 25, 215);
    text(shapes, "left_fire", 4, 160, 30, 33, "🔥", 25, C.orange, false, "center");
    text(shapes, "left_user_icon", 13, 236, 31, 34, "👤", 23, C.ink, false, "center");

    rect(shapes, "left_prompt_box", 14, 271, 139, 94, C.white, C.navy, 1.4);
    text(
      shapes,
      "left_prompt",
      19,
      274,
      129,
      87,
      "User1: Is this image real\nor fake?\nUser2: Identify the visual\nartifacts indicative of AI\ngeneration within this\nimage.\nUser3...",
      9.2,
      C.ink,
      false,
      "left",
    );

    roundRect(shapes, "left_encoder", 160, 244, 121, 32, C.white, C.navy, 1.6);
    text(shapes, "left_encoder_text", 170, 251, 102, 20, "Vision Encoder", 12, C.ink, true, "center");
    text(shapes, "left_encoder_fire", 151, 236, 27, 31, "🔥", 23, C.orange, false, "center");
  }

  function addStageTwo(shapes) {
    roundRect(shapes, "reward_box", 311, 42, 266, 44, C.peach, C.navy, 1.8);
    text(
      shapes,
      "reward_box_text",
      329,
      54,
      232,
      22,
      "Reward Model and GRPO Process",
      13,
      C.ink,
      true,
      "center",
    );

    rect(shapes, "cot_outer", 326, 102, 243, 50, C.white, C.navy, 1.2, true, 7);
    cotChip(shapes, "cot1", 339, 108, "CoT₁");
    cotChip(shapes, "cot2", 419, 108, "CoT₂");
    cotChip(shapes, "cot3", 499, 108, "CoT₃");
    text(shapes, "update_policy", 257, 115, 90, 18, "Update Policy", 11, C.ink, false, "center", -90);

    modelBar(shapes, "right_llm", 310, 167, 268, "Large Language Model");
    tokenStrip(shapes, "right_tokens", 320, 215);
    text(shapes, "right_fire", 299, 160, 30, 33, "🔥", 25, C.orange, false, "center");
    text(shapes, "right_user_icon", 306, 236, 31, 34, "👤", 23, C.ink, false, "center");

    rect(shapes, "right_prompt_box", 309, 269, 139, 96, C.white, C.navy, 1.4);
    text(
      shapes,
      "right_prompt",
      314,
      273,
      129,
      88,
      "User: Is this image real\nor fake?\nUse the format:\n① reasoning in <think> tag\n② result in <answer> tag\n③ [Clue]-[Why Fake/Real]\n-[If Fake/Real]",
      8.8,
      C.ink,
      false,
      "left",
    );

    roundRect(shapes, "right_encoder", 454, 244, 121, 32, C.white, C.navy, 1.6);
    text(shapes, "right_encoder_text", 463, 251, 104, 20, "Vision Encoder", 12, C.ink, true, "center");
    text(shapes, "right_encoder_snow", 443, 236, 29, 31, "❄️", 22, C.teal, false, "center");

    chevron(shapes, "cot1_to_reasoning", 578, 86, 18, 31);
    chevron(shapes, "cot2_to_reasoning", 578, 128, 18, 31);
  }

  function addReasoningPanels(shapes) {
    roundRect(shapes, "cot1_reasoning", 601, 37, 329, 181, C.white, C.navy, 1.7);
    text(shapes, "cot1_emoji", 581, 27, 40, 42, "😊", 29, C.yellow, false, "center");
    text(shapes, "cot1_heading", 615, 42, 225, 21, "CoT₁: reasoning and answer", 12.2, C.red, true);
    const cot1 =
      "- [Clue 1]: [Why fake]: The boy’s shirt has an illogical\n" +
      "pattern that seems to merge and distort. - [If real]: A\n" +
      "real shirt with a pattern would have a consistent\n" +
      "design across its surface, even when folded or creased.\n" +
      "- [Clue 2]: - [Why fake]: The skin on the face is\n" +
      "unnaturally smooth and flawless. - [If real]: Human\n" +
      "skin would possess some degree of texture and subtle\n" +
      "blemishes, even with makeup applied. - [Clue 3]: -\n" +
      "[Why fake]: Background is excessively blurred,\n" +
      "foreground is excessively sharp. - [If real]: Real\n" +
      "photographs exhibit a progressive and nuanced\n" +
      "transition in the depth of field...";
    const cot1Box = text(shapes, "cot1_body", 607, 58, 315, 154, cot1, 8.65, C.ink, false, "left");
    colorPhrases(cot1Box, [
      "shirt has an illogical\npattern",
      "skin on the face is\nunnaturally smooth and flawless",
      "Background is excessively blurred",
      "foreground is excessively sharp",
    ], C.red);

    roundRect(shapes, "cot2_reasoning", 601, 225, 329, 154, C.white, C.navy, 1.7);
    text(shapes, "cot2_emoji", 582, 214, 39, 42, "☹️", 29, C.yellow, false, "center");
    text(shapes, "cot2_heading", 615, 231, 225, 21, "CoT₂: reasoning and answer", 12.2, C.teal, true);
    const cot2 =
      "The first clue: - [Fake reason]: The girl’s hair appears\n" +
      "overly smooth. - [If real]: would capture the natural\n" +
      "texture and subtle imperfections of the hair, showing\n" +
      "individual strands and flyaways. - [Clue 2]: - [Why fake]:\n" +
      "The facial features of the subjects appear excessively\n" +
      "smooth, their skin textures unnaturally consistent\n" +
      "and flawless and devoid of any organic irregularities.\n" +
      "- [If real]: Human skin would possess some degree of\n" +
      "texture and subtle blemishes, even with makeup\n" +
      "applied...";
    const cot2Box = text(shapes, "cot2_body", 607, 247, 315, 126, cot2, 8.8, C.ink, false, "left");
    colorPhrases(cot2Box, [
      "girl’s hair appears\noverly smooth",
      "facial features of the subjects appear excessively\nsmooth",
      "skin textures unnaturally consistent\nand flawless",
    ], C.teal);
  }

  function addBottomRewards(shapes) {
    rect(shapes, "bottom_frame", 13, 390, 918, 138, C.panelBlue, C.navy, 1.6);
    dashedTab(shapes, "bottom_acc_tab", 14, 377, 101, 24, "Racc & Rfmt");
    dashedTab(shapes, "bottom_len_tab", 214, 377, 53, 24, "Rlen");
    dashedTab(shapes, "bottom_logic_tab", 399, 377, 117, 24, "Rstruc & Rlogic");

    roundRect(shapes, "bottom_accuracy", 20, 405, 183, 117, C.white, C.ink, 1.5);
    arrow(shapes, "bottom_left_book_in", 39, 493, 58, 493, C.purple, 3);
    arrow(shapes, "bottom_left_book_out", 107, 493, 123, 493, C.purple, 3);
    text(
      shapes,
      "bottom_accuracy_text",
      27,
      409,
      167,
      72,
      "<think>...</think>        CoT₁\n<answer> Fake </answer>\n- - - - - - - - - - - - - -\n<reason>...</reason>      CoT₂\n<answer> Real </answer>",
      9.6,
      C.teal,
      true,
      "left",
    );
    text(shapes, "bottom_accuracy_book", 49, 478, 58, 39, "📖", 28, C.navy, false, "center");
    text(shapes, "bottom_accuracy_scores", 125, 481, 68, 37, "R₁=2   ✓\nR₂=0   ⊗", 11.5, C.ink, true, "left");

    roundRect(shapes, "bottom_length", 211, 405, 181, 117, C.white, C.ink, 1.5);
    arrow(shapes, "bottom_middle_book", 238, 493, 257, 493, C.purple, 3);
    text(
      shapes,
      "bottom_length_text",
      218,
      409,
      164,
      73,
      "Length (1536 token)  CoT₁\nDetection result Correct\n- - - - - - - - - - - - - -\nLength (512 token)   CoT₂\nDetection result Incorrect",
      9.45,
      C.teal,
      true,
      "left",
    );
    text(shapes, "bottom_length_book", 251, 478, 59, 39, "📖", 28, C.navy, false, "center");
    text(shapes, "bottom_length_note", 310, 483, 78, 33, "CoT₁: shorter\nCoT₂: longer", 9.2, C.ink, true, "left");

    roundRect(shapes, "bottom_logic", 400, 405, 524, 117, C.white, C.ink, 1.5);
    arrow(shapes, "bottom_logic_book", 718, 465, 738, 465, C.purple, 3);
    arrow(shapes, "bottom_logic_robot", 787, 465, 807, 465, C.purple, 3);
    text(shapes, "bottom_logic_cot1", 410, 409, 305, 16, "CoT₁ Reasoning:", 10.8, C.ink, true, "left");
    text(
      shapes,
      "bottom_logic_cot1_body",
      410,
      426,
      310,
      36,
      "① -[Clue 1]: [Why fake]: ...-[If real] ...\n② Rigorous and exhibits strong internal consistency.",
      9.8,
      C.teal,
      true,
      "left",
    );
    line(shapes, "bottom_logic_separator", 410, 463, 716, 463, C.purple, 1.5, false, true);
    text(shapes, "bottom_logic_cot2", 410, 469, 305, 16, "CoT₂ Reasoning:", 10.8, C.ink, true, "left");
    text(
      shapes,
      "bottom_logic_cot2_body",
      410,
      486,
      310,
      32,
      "① The first clue: [Fake reason]: ...-[If real] ...\n② Logic is inconsistent, and informational redundancy.",
      9.5,
      C.teal,
      true,
      "left",
    );
    text(shapes, "bottom_logic_book", 733, 415, 58, 38, "📖", 28, C.navy, false, "center");
    text(shapes, "bottom_logic_robot", 746, 463, 53, 43, "🤖", 30, C.navy, false, "center");
    speechBubble(shapes, "critical_bubble", 807, 410, 108, 62);
    text(shapes, "critical_text", 827, 423, 76, 35, "💡 Critical\nthinking", 10.8, C.ink, true, "left");
    text(shapes, "bottom_logic_scores", 829, 474, 84, 40, "R₁=1.8  ✓\nR₂=0.3  ⊗", 11.4, C.ink, true, "left");
  }

  function modelBar(shapes, name, x, y, width, label) {
    roundRect(shapes, name, x, y, width, 45, C.paleBlue, C.paleBlue, 0.5);
    text(shapes, `${name}_text`, x + 47, y + 13, width - 80, 22, label, 13.5, C.ink, true, "center");
    text(shapes, `${name}_robot`, x + width - 41, y + 5, 34, 36, "🤖", 25, C.navy, false, "center");
  }

  function tokenStrip(shapes, name, x, y) {
    const fills = [C.rose, C.rose, C.rose, C.rose, C.rose, C.rose, C.mint, C.mint, C.mint, C.mint, C.mint];
    fills.forEach((fill, index) => {
      rect(shapes, `${name}_${index}`, x + index * 18, y, 15, 15, fill, fill, 0);
    });
    text(shapes, `${name}_ellipsis`, x + 116, y - 2, 35, 17, "••", 12, C.ink, true, "center");
  }

  function cotChip(shapes, name, x, y, label) {
    roundRect(shapes, name, x, y, 54, 38, C.white, C.teal, 2, true);
    text(shapes, `${name}_text`, x + 5, y + 8, 44, 22, label, 12.5, C.ink, true, "center");
  }

  function dashedTab(shapes, name, x, y, width, label) {
    roundRect(shapes, name, x, y, width, 24, C.white, C.ink, 1.5, true);
    text(shapes, `${name}_text`, x + 5, y + 5, width - 10, 16, label, 11.2, C.ink, true, "center");
  }

  function chevron(shapes, name, x, y, width, height) {
    const shape = shapes.AddShape(33, x, y, width, height);
    shape.Name = `${PREFIX}${name}`;
    shape.Fill.Solid();
    shape.Fill.ForeColor.RGB = C.purpleLight;
    shape.Line.Visible = 0;
    return shape;
  }

  function speechBubble(shapes, name, x, y, width, height) {
    const shape = shapes.AddShape(107, x, y, width, height);
    shape.Name = `${PREFIX}${name}`;
    shape.Fill.Solid();
    shape.Fill.ForeColor.RGB = C.paleBlue;
    shape.Line.Visible = -1;
    shape.Line.ForeColor.RGB = C.navy;
    shape.Line.Weight = 1.6;
    return shape;
  }

  function preserveReferencePhotos(shapes) {
    const pictures = [];
    for (let index = shapes.Count; index >= 1; index -= 1) {
      const shape = shapes.Item(index);
      const type = Number(shape.Type);
      if (type === 11 || type === 13) pictures.unshift(shape);
      else shape.Delete();
    }
    if (pictures.length < 2) {
      throw new Error(`参考底稿应包含两张嵌入图片，实际找到 ${pictures.length} 张。`);
    }
    pictures[0].Name = `${PREFIX}left_examples`;
    pictures[0].Left = 161;
    pictures[0].Top = 279;
    pictures[0].Width = 121;
    pictures[0].Height = 86;
    pictures[1].Name = `${PREFIX}right_children`;
    pictures[1].Left = 454;
    pictures[1].Top = 279;
    pictures[1].Width = 125;
    pictures[1].Height = 86;
  }

  function rect(shapes, name, x, y, width, height, fill, stroke, weight = 1, dashed = false, radius = 0) {
    return baseShape(shapes, radius ? 5 : 1, name, x, y, width, height, fill, stroke, weight, dashed);
  }

  function roundRect(shapes, name, x, y, width, height, fill, stroke, weight = 1, dashed = false) {
    return baseShape(shapes, 5, name, x, y, width, height, fill, stroke, weight, dashed);
  }

  function baseShape(shapes, type, name, x, y, width, height, fill, stroke, weight, dashed) {
    const shape = shapes.AddShape(type, x, y, width, height);
    shape.Name = `${PREFIX}${name}`;
    shape.Fill.Solid();
    shape.Fill.ForeColor.RGB = fill;
    shape.Line.Visible = weight > 0 ? -1 : 0;
    if (weight > 0) {
      shape.Line.ForeColor.RGB = stroke;
      shape.Line.Weight = weight;
      if (dashed) {
        try { shape.Line.DashStyle = 4; } catch {}
      }
    }
    return shape;
  }

  function text(
    shapes,
    name,
    x,
    y,
    width,
    height,
    value,
    size,
    color,
    bold = false,
    alignment = "left",
    rotation = 0,
  ) {
    const shape = shapes.AddTextbox(1, x, y, width, height);
    shape.Name = `${PREFIX}${name}`;
    shape.Fill.Visible = 0;
    shape.Line.Visible = 0;
    shape.Rotation = rotation;
    const frame = shape.TextFrame;
    frame.MarginLeft = 0;
    frame.MarginRight = 0;
    frame.MarginTop = 0;
    frame.MarginBottom = 0;
    frame.WordWrap = -1;
    frame.VerticalAnchor = alignment === "center" ? 3 : 1;
    const range = frame.TextRange;
    range.Text = value;
    range.Font.Name = "Comic Sans MS";
    range.Font.Size = size;
    range.Font.Bold = bold ? -1 : 0;
    range.Font.Color.RGB = color;
    range.ParagraphFormat.Alignment = alignment === "center" ? 2 : alignment === "right" ? 3 : 1;
    return shape;
  }

  function line(shapes, name, x1, y1, x2, y2, color, weight = 1.5, endArrow = false, dashed = false) {
    const shape = shapes.AddLine(x1, y1, x2, y2);
    shape.Name = `${PREFIX}${name}`;
    shape.Line.ForeColor.RGB = color;
    shape.Line.Weight = weight;
    if (endArrow) shape.Line.EndArrowheadStyle = 3;
    if (dashed) {
      try { shape.Line.DashStyle = 4; } catch {}
    }
    return shape;
  }

  function arrow(shapes, name, x1, y1, x2, y2, color, weight = 1.8) {
    return line(shapes, name, x1, y1, x2, y2, color, weight, true, false);
  }

  function doubleArrow(shapes, name, x1, y1, x2, y2, color, weight = 1.8) {
    const shape = line(shapes, name, x1, y1, x2, y2, color, weight, true, false);
    shape.Line.BeginArrowheadStyle = 3;
    return shape;
  }

  function colorPhrases(shape, phrases, color) {
    const source = String(shape.TextFrame.TextRange.Text || "");
    for (const phrase of phrases) {
      const index = source.indexOf(phrase);
      if (index < 0) continue;
      try {
        const range = shape.TextFrame.TextRange.Characters(index + 1, phrase.length);
        range.Font.Color.RGB = color;
        range.Font.Bold = -1;
      } catch {}
    }
  }

  function rgb(red, green, blue) {
    if (typeof globalThis.RGB === "function") return globalThis.RGB(red, green, blue);
    return red + green * 256 + blue * 65536;
  }

  globalThis.drawWpsReferenceDiagram = drawWpsReferenceDiagram;
})();
