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

    var totalScreens = selectedX + 1; // e.g., X3 = 3 PMS screens + 1 Underly Base = 4 Total Screens
    var underlyScreenNum = totalScreens; // Last screen
    var expectedUnderlyVal = underlyScreenNum * 10;
    var expectedUnderlyPrefix = (expectedUnderlyVal < 100 ? "0" + expectedUnderlyVal : "" + expectedUnderlyVal) + "-";

    // --- 2. AUTO-CORRECT & POPUP NOTIFICATION FOR UNDERLY BASE SWATCH ---
    var underlySwatch = findUnderlyBaseSwatch(doc);

    if (underlySwatch) {
        var oldSwatchName = underlySwatch.name;

        // Check if swatch does not start with expected prefix (e.g., "040-")
        if (oldSwatchName.indexOf(expectedUnderlyPrefix) !== 0) {
            var newSwatchName = oldSwatchName.replace(/^[0-9]{3}[-_I\s]*/i, expectedUnderlyPrefix);
            
            if (newSwatchName === oldSwatchName) {
                newSwatchName = expectedUnderlyPrefix + oldSwatchName;
            }

            // Rename swatch in document
            underlySwatch.name = newSwatchName;

            // --- POPUP NOTIFICATION INDICATION ---
            var noticeMsg = "ℹ️ UNDERLY BASE SWATCH AUTO-UPDATED ℹ️\n";
            noticeMsg += "=========================================\n\n";
            noticeMsg += "Process selected: X" + selectedX + " (SCREEN ." + underlyScreenNum + " is Underly Base)\n\n";
            noticeMsg += "• Old Swatch Name : \"" + oldSwatchName + "\"\n";
            noticeMsg += "• New Swatch Name : \"" + newSwatchName + "\"\n\n";
            noticeMsg += "The swatch name was automatically corrected to match SCREEN ." + underlyScreenNum + "!";

            alert(noticeMsg, "Swatch Rename Indication");
        }
    }

    // --- 3. VALIDATE PMS SWATCHES (STRICT "010-I-" CHECK) ---
    var missingSwatches = [];
    var matchedSwatchesList = [];

    for (var s = 0; s < totalScreens; s++) {
        var screenNum = s + 1;
        var isUnderlyBase = (s === totalScreens - 1);

        var sw = findSwatchForScreen(doc, screenNum, isUnderlyBase);

        if (!sw && !isUnderlyBase) {
            var val = screenNum * 10;
            var prefixStr = ((val < 100) ? "0" + val : "" + val) + "-I-";
            missingSwatches.push("SCREEN ." + screenNum + " -> Missing Swatch starting with: '" + prefixStr + "'");
        } else {
            matchedSwatchesList.push(sw);
        }
    }

    // --- 4. SHOW ERROR INDICATION IF PMS COLOR SWATCH IS MISSING ---
    if (missingSwatches.length > 0) {
        var errorMsg = "⚠️ SWATCH ERROR INDICATION ⚠️\n";
        errorMsg += "===============================\n\n";
        errorMsg += "The required PMS color swatch format was not found:\n\n";

        for (var m = 0; m < missingSwatches.length; m++) {
            errorMsg += "• " + missingSwatches[m] + "\n";
        }

        errorMsg += "\nPlease create swatches starting with '010-I-', '020-I-', etc. and try again.";

        alert(errorMsg, "Missing Swatch Error");
        return; // STOP execution
    }

    // --- 5. GENERATE LAYOUT ---
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

        // Right text: "BLACK - BK" or "UNDERLY BASE"
        var rightFrame = doc.textFrames.add();
        rightFrame.contents = rightTextContent;
        formatText(rightFrame, screenColor);

        rightFrame.left = leftFrame.left + leftFrame.width;
        rightFrame.top = currentY;

        // Attributes note applied to ALL right-side text objects
        rightFrame.note = "DELETE FOR DTS";

        // Group together
        leftFrame.move(lineGroup, ElementPlacement.INSIDE);
        rightFrame.move(lineGroup, ElementPlacement.INSIDE);
    }

    app.redraw();

    // --- HELPER 1: SEARCH FOR UNDERLY BASE SWATCH ---
    function findUnderlyBaseSwatch(document) {
        for (var s = 0; s < document.swatches.length; s++) {
            var swName = document.swatches[s].name.toUpperCase();
            if (swName.indexOf("UNDERLY BASE") !== -1 || swName.indexOf("UNDERY BASE") !== -1) {
                return document.swatches[s];
            }
        }
        return null;
    }

    // --- HELPER 2: MATCH SWATCH PER SCREEN ---
    function findSwatchForScreen(document, screenNum, isUnderlyBase) {
        if (isUnderlyBase) {
            return findUnderlyBaseSwatch(document);
        }

        var val = screenNum * 10;
        var prefixWithI = ((val < 100) ? "0" + val : "" + val) + "-I-";

        for (var s = 0; s < document.swatches.length; s++) {
            var sw = document.swatches[s];
            if (sw.name.indexOf(prefixWithI) === 0) {
                return sw;
            }
        }
        return null;
    }

    // --- HELPER 3: PARSE INITIAL & COLOUR NAME ---
    // Example: "010-I-Bk-black" -> "BLACK - BK"
    function parseSwatchText(swatchName, prefixStr) {
        var text = swatchName;

        // 1. Remove prefix ("010-I-")
        if (text.indexOf(prefixStr) === 0) {
            text = text.substring(prefixStr.length);
        }

        // 2. Remove trailing " C" or " U"
        text = text.replace(/\s+[C|U]$/i, "");
        text = text.replace(/^\s+|\s+$/g, '');

        // 3. Extract Initial and Color Name separated by '-'
        if (text.indexOf("-") !== -1) {
            var parts = text.split("-");
            if (parts.length >= 2) {
                var initial = parts[0].replace(/^\s+|\s+$/g, '').toUpperCase();
                var colorName = parts.slice(1).join("-").replace(/^\s+|\s+$/g, '').toUpperCase();
                return colorName + " - " + initial; // e.g. "BLACK - BK"
            }
        }

        // Fallback for standard swatch names without hyphens
        return text.toUpperCase();
    }

    // --- HELPER 4: FORMAT TEXT ---
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