#target illustrator

(function generateScreenLabelsUI() {
    if (app.documents.length === 0) {
        alert("Please open an Illustrator document first!");
        return;
    }

    var doc = app.activeDocument;
    var selectedType = null; // 'X' or 'P'
    var selectedVal = null;  // 1 through 10

    // --- 1. SCRIPT UI WINDOW (X1-X10 AND P1-P10 BUTTONS) ---
    var win = new Window("dialog", "Select Screen Process");
    win.orientation = "column";
    win.alignChildren = ["center", "top"];
    win.spacing = 15;
    win.margins = 20;

    var title = win.add("statictext", undefined, "Choose Process Type:");
    title.graphics.font = ScriptUI.newFont("dialog", "BOLD", 13);

    // PANEL 1: X PROCESS (WITH UNDERLY BASE)
    var panelX = win.add("panel", undefined, "X Process (Includes Underly Base)");
    panelX.orientation = "column";
    panelX.spacing = 8;
    panelX.margins = 12;

    var xRow1 = panelX.add("group");
    var xRow2 = panelX.add("group");

    for (var i = 1; i <= 10; i++) {
        var pRow = (i <= 5) ? xRow1 : xRow2;
        var btnX = pRow.add("button", undefined, "X" + i);
        btnX.size = [55, 32];
        btnX.val = i;

        btnX.onClick = function() {
            selectedType = 'X';
            selectedVal = this.val;
            win.close();
        };
    }

    // PANEL 2: P PROCESS (WITHOUT UNDERLY BASE)
    var panelP = win.add("panel", undefined, "P Process (No Underly Base - Color Only)");
    panelP.orientation = "column";
    panelP.spacing = 8;
    panelP.margins = 12;

    var pRow1 = panelP.add("group");
    var pRow2 = panelP.add("group");

    for (var j = 1; j <= 10; j++) {
        var parentRowP = (j <= 5) ? pRow1 : pRow2;
        var btnP = parentRowP.add("button", undefined, "P" + j);
        btnP.size = [55, 32];
        btnP.val = j;

        btnP.onClick = function() {
            selectedType = 'P';
            selectedVal = this.val;
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

    if (selectedType === null || selectedVal === null) return; // User canceled

    // Determine process parameters
    var hasUnderlyBase = (selectedType === 'X');
    var totalScreens = hasUnderlyBase ? (selectedVal + 1) : selectedVal;

    // --- 2. CONFIRM & RENAME UNDERLY BASE SWATCH (X PROCESS ONLY) ---
    if (hasUnderlyBase) {
        var underlyScreenNum = totalScreens;
        var expectedUnderlyVal = underlyScreenNum * 10;
        var expectedUnderlyPrefix = (expectedUnderlyVal < 100 ? "0" + expectedUnderlyVal : "" + expectedUnderlyVal) + "-";

        var underlySwatch = findUnderlyBaseSwatch(doc);

        if (underlySwatch) {
            var oldSwatchName = underlySwatch.name;

            // Check if prefix doesn't match expected (e.g. "030-" instead of "040-")
            if (oldSwatchName.indexOf(expectedUnderlyPrefix) !== 0) {
                var newSwatchName = oldSwatchName.replace(/^[0-9]{3}[-_I\s]*/i, expectedUnderlyPrefix);
                
                if (newSwatchName === oldSwatchName) {
                    newSwatchName = expectedUnderlyPrefix + oldSwatchName;
                }

                // ASK USER WITH INTERACTIVE POPUP DIALOG
                var shouldChange = askToRenameSwatch(oldSwatchName, newSwatchName, underlyScreenNum, selectedVal);

                if (shouldChange) {
                    underlySwatch.name = newSwatchName;
                }
            }
        }
    }

    // --- 3. VALIDATE PMS COLOR SWATCHES ---
    var missingSwatches = [];
    var matchedSwatchesList = [];

    for (var s = 0; s < totalScreens; s++) {
        var screenNum = s + 1;
        var isUnderlyBase = hasUnderlyBase && (s === totalScreens - 1);

        var sw = findSwatchForScreen(doc, screenNum, isUnderlyBase);

        if (!sw && !isUnderlyBase) {
            var val = screenNum * 10;
            var prefixStr = ((val < 100) ? "0" + val : "" + val) + "-I-";
            missingSwatches.push("SCREEN ." + screenNum + " -> Missing Swatch starting with: '" + prefixStr + "'");
        } else {
            matchedSwatchesList.push(sw);
        }
    }

    // --- 4. SHOW ERROR IF PMS COLOR SWATCH IS MISSING ---
    if (missingSwatches.length > 0) {
        var errorMsg = "⚠️ SWATCH ERROR INDICATION (" + selectedType + selectedVal + " PROCESS) ⚠️\n";
        errorMsg += "=============================================\n\n";
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
        var isUnderlyBase = hasUnderlyBase && (k === totalScreens - 1);

        var matchedSwatch = matchedSwatchesList[k];
        var screenColor = matchedSwatch ? matchedSwatch.color : null;

        var rightTextContent = "";

        if (isUnderlyBase) {
            rightTextContent = "UNDERLY BASE";
        } else if (matchedSwatch) {
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

    // --- HELPER 1: ASK USER TO RENAME SWATCH (YES / NO DIALOG) ---
    function askToRenameSwatch(oldName, newName, screenNum, processVal) {
        var dlg = new Window("dialog", "Underly Base Swatch Confirmation");
        dlg.orientation = "column";
        dlg.alignChildren = ["center", "top"];
        dlg.spacing = 15;
        dlg.margins = 20;

        var titleBox = dlg.add("statictext", undefined, "ℹ️ UNDERLY BASE SWATCH MISMATCH ℹ️");
        titleBox.graphics.font = ScriptUI.newFont("dialog", "BOLD", 13);

        var msgText = "Process Selected: X" + processVal + " (SCREEN ." + screenNum + " is Underly Base)\n\n" +
                       "• Current Swatch Name: \"" + oldName + "\"\n" +
                       "• Proposed Swatch Name: \"" + newName + "\"\n\n" +
                       "Would you like to change the swatch name to match SCREEN ." + screenNum + "?";

        var txt = dlg.add("statictext", undefined, msgText, {multiline: true});
        txt.preferredSize.width = 380;

        var btnGroup = dlg.add("group");
        btnGroup.orientation = "row";
        btnGroup.spacing = 15;

        var changeBtn = btnGroup.add("button", undefined, "Change Name");
        changeBtn.size = [120, 35];

        var keepBtn = btnGroup.add("button", undefined, "Keep Original");
        keepBtn.size = [120, 35];

        var userChoice = false;

        changeBtn.onClick = function() {
            userChoice = true;
            dlg.close();
        };

        keepBtn.onClick = function() {
            userChoice = false;
            dlg.close();
        };

        dlg.show();
        return userChoice;
    }

    // --- HELPER 2: SEARCH FOR UNDERLY BASE SWATCH ---
    function findUnderlyBaseSwatch(document) {
        for (var s = 0; s < document.swatches.length; s++) {
            var swName = document.swatches[s].name.toUpperCase();
            if (swName.indexOf("UNDERLY BASE") !== -1 || swName.indexOf("UNDERY BASE") !== -1) {
                return document.swatches[s];
            }
        }
        return null;
    }

    // --- HELPER 3: MATCH SWATCH PER SCREEN ---
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

    // --- HELPER 4: PARSE INITIAL & COLOUR NAME (STRIP (MUTE), (TRICK), ETC.) ---
    function parseSwatchText(swatchName, prefixStr) {
        var text = swatchName;

        // 1. Remove prefix ("010-I-")
        if (text.indexOf(prefixStr) === 0) {
            text = text.substring(prefixStr.length);
        }

        // 2. Remove parenthetical tags like (MUTE), (TRICK), etc.
        text = text.replace(/\s*\([^)]*\)/g, "");

        // 3. Remove trailing " C" or " U"
        text = text.replace(/\s+[C|U]$/i, "");
        text = text.replace(/^\s+|\s+$/g, '');

        // 4. Extract Initial and Color Name separated by '-'
        if (text.indexOf("-") !== -1) {
            var parts = text.split("-");
            if (parts.length >= 2) {
                var initial = parts[0].replace(/^\s+|\s+$/g, '').toUpperCase();
                var colorName = parts.slice(1).join("-").replace(/^\s+|\s+$/g, '').toUpperCase();
                return colorName + " - " + initial; // Output: "BLACK - BK"
            }
        }

        return text.toUpperCase();
    }

    // --- HELPER 5: FORMAT TEXT ---
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