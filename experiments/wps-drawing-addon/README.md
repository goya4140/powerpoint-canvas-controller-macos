# WPS native drawing experiment

This macOS experiment proves that a WPS Presentation JavaScript add-in can create and save native,
editable PPTX objects through the WPP object model.

## Run

Install the experiment-only development dependency once:

```bash
cd experiments/wps-drawing-addon
npm install
cd ../..
```

Then run the isolated end-to-end test:

```bash
npm run experiment:wps
```

The runner:

1. Copies `assets/blank-16x9.pptx` to an ignored test-output directory.
2. Starts the local WPS add-in development server.
3. Opens a separate WPS instance with the test deck.
4. Creates text, rounded rectangles, and native connectors with arrowheads.
5. Saves the presentation and verifies the expected shape names in the PPTX package.
6. Restores the user's previous WPS add-in configuration.

The generated file is `test-output/wps/wps-native-drawing-test.pptx`.

Automatic drawing is restricted to that exact test filename. The ribbon button is the only path that
intentionally allows drawing into another active presentation.
