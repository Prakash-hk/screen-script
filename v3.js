#target illustrator

(function generateScreenLabelsUI() {
    if (app.documents.length === 0) {
        alert("Please open an Illustrator document first!");
        return;
    }

    var doc = app.activeDocument;
    var selectedX = null;

    // --- 1. SCRIPT UI WINDOW (X1 - X10 BUTTONS) ---
    var win = new Window("dialog", "Select Screen Process");
    win.orientation = "column";
    win.alignChildren = ["center", "top"];
    win.spacing = 15;
    win.margins = 20;

    var title = win.add("statictext", undefined, "Choose Process Multiplier:");
    title.graphics.font = ScriptUI.newFont("dialog", "BOLD", 13);

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

    var cancelBtn = win.add("button", undefined, "Cancel");
    cancelBtn.size = [100, 30];
    cancelBtn.onClick = function() {
        win.close();
    };

    win.show();

    if (selectedX === null) return; // User canceled

    // --- 2. VALIDATE SWATCHES (SKIP "-I-" ERROR FOR UNDERLY BASE) ---
    var totalScreens = selectedX + 1; // e.g., X3 -> 4 screens
    var missingSwatches = [];
    var matchedSwatchesList = [];

    for (var s = 0; s < totalScreens; s++) {
        var screenNum = s + 1;
        var isUnderlyBase = (s === totalScreens - 1);

        var sw = findSwatchForScreen(doc, screenNum, isUnderlyBase);

        // Only add to missingSwatches if it is NOT UNDERLY BASE
        if (!sw && !isUnderlyBase) {
            var val = screenNum * 10;
            var prefixStr = ((val < 100) ? "0" + val : "" + val) + "-I-";
            missingSwatches.push("SCREEN ." + screenNum + " -> Missing Swatch starting with: '" + prefixStr + "'");
        } else {
            matchedSwatchesList.push(sw);
        }
    }

    // --- 3. SHOW ERROR DIALOG ONLY FOR PMS COLOR SCREENS ---
    if (missingSwatches.length > 0) {
        var errorMsg = "⚠️ SWATCH ERROR INDICATION ⚠️\n";
        errorMsg += "===============================\n\n";
        errorMsg += "The required color swatch format was not found:\n\n";

        for (var m = 0; m < missingSwatches.length; m++) {
            errorMsg += "• " + missingSwatches[m] + "\n";
        }

        errorMsg += "\nPlease create swatches starting with '010-I-', '020-I-', etc. and try again.";

        alert(errorMsg, "Missing Swatch Error");
        return; // STOP execution completely
    }

    // --- 4. GENERATE LAYOUT ---
    var abIndex = doc.artboards.getActiveArtboardIndex();
    var abBounds = doc.artboards[abIndex].artboardRect;

    var startX = abBounds[0] + 50;
    var startY = abBounds[1] - 50;
    var lineSpacing = 60;

    for (var k = 0; k < totalScreens; k++) {
        var screenNum = k + 1;
        var currentY = startY - (k * lineSpacing);
        var isUnderlyBase = (k === totalScreens - 1);

        var matchedSwatch = matchedSwatchesList[k];
        var screenColor = matchedSwatch ? matchedSwatch.color : null;

        var rightTextContent = "UNDERLY BASE";

        if (!isUnderlyBase && matchedSwatch) {
            var val = screenNum * 10;
            var prefixStr = ((val < 100) ? "0" + val : "" + val) + "-I-";
            rightTextContent = parseSwatchText(matchedSwatch.name, prefixStr);
        }

        // Line Group
        var lineGroup = doc.groupItems.add();

        // Left text: "SCREEN .1 "
        var leftFrame = doc.textFrames.add();
        leftFrame.contents = "SCREEN ." + screenNum + " ";
        leftFrame.note = "";
        formatText(leftFrame, screenColor);

        leftFrame.left = startX;
        leftFrame.top = currentY;

        // Right text: "PMS 188" or "UNDERLY BASE"
        var rightFrame = doc.textFrames.add();
        rightFrame.contents = rightTextContent;
        formatText(rightFrame, screenColor);

        rightFrame.left = leftFrame.left + leftFrame.width;
        rightFrame.top = currentY;

        // Attributes note applied to ALL right text
        rightFrame.note = "DELETE FOR DTS";

        // Group together
        leftFrame.move(lineGroup, ElementPlacement.INSIDE);
        rightFrame.move(lineGroup, ElementPlacement.INSIDE);
    }

    app.redraw();

    // --- HELPER 1: FLEXIBLE SWATCH SEARCH ---
    function findSwatchForScreen(document, screenNum, isUnderlyBase) {
        var val = screenNum * 10;
        var prefixWithI = ((val < 100) ? "0" + val : "" + val) + "-I-";
        var prefixWithoutI = ((val < 100) ? "0" + val : "" + val) + "-";

        // 1. Try strict "010-I-" matching first
        for (var s = 0; s < document.swatches.length; s++) {
            var sw = document.swatches[s];
            if (sw.name.indexOf(prefixWithI) === 0) {
                return sw;
            }
        }

        // 2. If this is Underly Base, allow non-I format (e.g., "030-underly base" or "underly base")
        if (isUnderlyBase) {
            // Try "030-"
            for (var s = 0; s < document.swatches.length; s++) {
                var sw = document.swatches[s];
                if (sw.name.indexOf(prefixWithoutI) === 0) {
                    return sw;
                }
            }
            // Try containing "underly base"
            for (var s = 0; s < document.swatches.length; s++) {
                var sw = document.swatches[s];
                if (sw.name.toUpperCase().indexOf("UNDERLY BASE") !== -1) {
                    return sw;
                }
            }
        }

        return null;
    }

    // --- HELPER 2: STRIP PREFIX AND SUFFIX ---
    function parseSwatchText(swatchName, prefixStr) {
        var text = swatchName;

        if (text.indexOf(prefixStr) === 0) {
            text = text.substring(prefixStr.length);
        }

        text = text.replace(/\s+[C|U]$/i, "");
        text = text.replace(/^\s+|\s+$/g, '').toUpperCase();

        return text;
    }

    // --- HELPER 3: FORMAT TEXT ---
    function formatText(frame, color) {
        var tr = frame.textRange;
        tr.characterAttributes.size = 48;
        tr.characterAttributes.leading = 60;
        if (color) tr.characterAttributes.fillColor = color;

        try {
            tr.characterAttributes.textFont = app.textFonts.getByName("MyriadPro-Regular");
        } catch (e) {
            try {
                tr.characterAttributes.textFont = app.textFonts.getByName("ArialMT");
            } catch (err) {}
        }
    }
})();