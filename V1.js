#target illustrator

(function generateScreenLabelsUI() {
    if (app.documents.length === 0) {
        alert("Please open an Illustrator document first!");
        return;
    }

    var selectedX = null;

    // --- 1. SCRIPT UI WINDOW (X1 - X10 BUTTONS) ---
    var win = new Window("dialog", "Select Screen Process");
    win.orientation = "column";
    win.alignChildren = ["center", "top"];
    win.spacing = 15;
    win.margins = 20;

    var title = win.add("statictext", undefined, "Choose Process Multiplier:");
    title.graphics.font = ScriptUI.newFont("dialog", "BOLD", 13);

    // Button Grid Container
    var gridPanel = win.add("panel", undefined, "Process Options");
    gridPanel.orientation = "column";
    gridPanel.spacing = 10;
    gridPanel.margins = 15;

    var row1 = gridPanel.add("group"); // Row for X1 - X5
    row1.orientation = "row";
    row1.spacing = 8;

    var row2 = gridPanel.add("group"); // Row for X6 - X10
    row2.orientation = "row";
    row2.spacing = 8;

    // Generate Buttons X1 through X10
    for (var i = 1; i <= 10; i++) {
        var parentRow = (i <= 5) ? row1 : row2;
        var btn = parentRow.add("button", undefined, "X" + i);
        btn.size = [60, 35];
        btn.xValue = i;

        btn.onClick = function() {
            selectedX = this.xValue;
            win.close();
        };
    }

    // Cancel Button
    var cancelBtn = win.add("button", undefined, "Cancel");
    cancelBtn.size = [100, 30];
    cancelBtn.onClick = function() {
        win.close();
    };

    win.show();

    if (selectedX === null) return; // User canceled

    // --- 2. GENERATE LAYOUT BASED ON SELECTION ---
    var doc = app.activeDocument;
    var abIndex = doc.artboards.getActiveArtboardIndex();
    var abBounds = doc.artboards[abIndex].artboardRect; // [left, top, right, bottom]

    var startX = abBounds[0] + 50;
    var startY = abBounds[1] - 50;
    var lineSpacing = 60; // Vertical line gap

    // Total screens = selectedX + 1 (e.g., X3 -> 3 PMS screens + 1 UNDERLY BASE)
    var totalScreens = selectedX + 1;

    for (var k = 0; k < totalScreens; k++) {
        var screenNum = k + 1;
        var currentY = startY - (k * lineSpacing);

        // Determine Prefix (010, 020, 030...)
        var val = screenNum * 10;
        var prefix = (val < 100) ? "0" + val : "" + val;

        // Search Swatch Panel for matching swatch starting with prefix (e.g. 010)
        var matchedSwatch = findSwatchByPrefix(doc, prefix);
        var screenColor = matchedSwatch ? matchedSwatch.color : null;

        var rightTextContent = "";
        var isUnderlyBase = (k === totalScreens - 1);

        if (matchedSwatch) {
            // Parse name: "010-I-PMS 188 C" -> "PMS 188"
            var parsedName = parseSwatchText(matchedSwatch.name, prefix);
            if (parsedName.indexOf("UNDERLY BASE") !== -1) {
                rightTextContent = "UNDERLY BASE";
                isUnderlyBase = true;
            } else {
                rightTextContent = parsedName;
            }
        } else {
            // Fallback if swatch is missing
            rightTextContent = isUnderlyBase ? "UNDERLY BASE" : "XXXXXX";
        }

        // Group per line
        var lineGroup = doc.groupItems.add();

        // Left text: "SCREEN .1 "
        var leftFrame = doc.textFrames.add();
        leftFrame.contents = "SCREEN ." + screenNum + " ";
        leftFrame.note = ""; // No note on left text
        formatText(leftFrame, screenColor);

        leftFrame.left = startX;
        leftFrame.top = currentY;

        // Right text: "PMS 188" or "UNDERLY BASE"
        var rightFrame = doc.textFrames.add();
        rightFrame.contents = rightTextContent;
        formatText(rightFrame, screenColor);

        rightFrame.left = leftFrame.left + leftFrame.width;
        rightFrame.top = currentY;

        // Add "DELETE FOR DTS" note only to PMS color text frames
        if (!isUnderlyBase) {
            rightFrame.note = "DELETE FOR DTS";
        } else {
            rightFrame.note = "";
        }

        // Move frames into the group
        leftFrame.move(lineGroup, ElementPlacement.INSIDE);
        rightFrame.move(lineGroup, ElementPlacement.INSIDE);
    }

    app.redraw();

    // --- HELPER 1: FIND SWATCH BY PREFIX ---
    function findSwatchByPrefix(document, prefix) {
        for (var s = 0; s < document.swatches.length; s++) {
            var sw = document.swatches[s];
            if (sw.name.indexOf(prefix) === 0) {
                return sw;
            }
        }
        return null;
    }

    // --- HELPER 2: PARSE SWATCH NAME TO COLOR TEXT ---
    // Example: "010-I-PMS 188 C" -> "PMS 188"
    function parseSwatchText(swatchName, prefix) {
        var text = swatchName;

        // 1. Remove leading prefix ("010-I-", "010-", "010 ", etc.)
        var prefixRegex = new RegExp("^" + prefix + "[-_\\s]*(I[-_\\s]*)?", "i");
        text = text.replace(prefixRegex, "");

        // 2. Remove trailing suffix (" C" or " U")
        text = text.replace(/\s+[C|U]$/i, "");

        // 3. Trim extra spaces & convert to uppercase
        text = text.replace(/^\s+|\s+$/g, '').toUpperCase();

        return text;
    }

    // --- HELPER 3: TEXT FORMATTING ---
    function formatText(frame, color) {
        var tr = frame.textRange;
        tr.characterAttributes.size = 48;
        tr.characterAttributes.leading = 60;

        if (color !== null) {
            tr.characterAttributes.fillColor = color;
        }

        try {
            tr.characterAttributes.textFont = app.textFonts.getByName("MyriadPro-Regular");
        } catch (e) {
            try {
                tr.characterAttributes.textFont = app.textFonts.getByName("ArialMT");
            } catch (err) {}
        }
    }
})();