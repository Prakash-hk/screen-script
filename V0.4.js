#target illustrator

(function generateScreenLabelsUI() {
    if (app.documents.length === 0) {
        showCustomErrorDialog("No Document Open", ["Please open an Illustrator document first!"], "SYSTEM");
        return;
    }

    var doc = app.activeDocument;
    var selectedType = null; // 'X' or 'P'
    var selectedVal = null;  // 1 through 10

    // Cache Helvetica Neue Bold Font
    var targetFont = getHelveticaNeueBold();

    // --- 1. SCRIPT UI WINDOW (MAIN SELECTOR) ---
    var win = new Window("dialog", "Screen Process Generator");
    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.spacing = 15;
    win.margins = 20;

    // Header Title
    var header = win.add("group");
    header.orientation = "column";
    header.alignChildren = ["center", "top"];
    var title = header.add("statictext", undefined, "SELECT PROCESS METHOD");
    setSafeScriptUIFont(title, "dialog", "BOLD", 14);

    // --- PANEL 1: X PROCESS (WITH UNDERLY BASE) ---
    var panelX = win.add("panel", undefined, "X Process ( Includes Underly Base )");
    panelX.orientation = "column";
    panelX.spacing = 8;
    panelX.margins = 14;

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

    // --- PANEL 2: P PROCESS (WITHOUT UNDERLY BASE) ---
    var panelP = win.add("panel", undefined, "P Process ( Color Screens Only )");
    panelP.orientation = "column";
    panelP.spacing = 8;
    panelP.margins = 14;

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
    cancelBtn.size = [100, 32];
    cancelBtn.alignment = ["center", "top"];
    cancelBtn.onClick = function() {
        win.close();
    };

    win.show();

    if (selectedType === null || selectedVal === null) return; // User canceled

    // Process variables
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

            if (oldSwatchName.indexOf(expectedUnderlyPrefix) !== 0) {
                var newSwatchName = oldSwatchName.replace(/^[0-9]{3}[-_I\s]*/i, expectedUnderlyPrefix);
                
                if (newSwatchName === oldSwatchName) {
                    newSwatchName = expectedUnderlyPrefix + oldSwatchName;
                }

                // CONFIRMATION POPUP
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
            missingSwatches.push("SCREEN " + screenNum + ". -> Missing swatch starting with: '" + prefixStr + "'");
        } else {
            matchedSwatchesList.push(sw);
        }
    }

    // --- 4. ERROR DIALOG IF SWATCH IS MISSING ---
    if (missingSwatches.length > 0) {
        showCustomErrorDialog("Missing Color Swatches", missingSwatches, selectedType + selectedVal);
        return; // STOP execution
    }

    // --- 5. GENERATE LAYOUT (0.5 PT BOUNDS SPACING) ---
    var abIndex = doc.artboards.getActiveArtboardIndex();
    var abBounds = doc.artboards[abIndex].artboardRect;

    var startX = abBounds[0] + 50;
    var startY = abBounds[1] - 50;
    
    var fontSize = 18;
    var fontLeading = 22;
    var targetGap = 0.5; // Exactly 0.5 pt gap between text row bounds

    var previousRowBottom = null;

    for (var k = 0; k < totalScreens; k++) {
        var screenNum = k + 1;
        var isUnderlyBase = hasUnderlyBase && (k === totalScreens - 1);

        var matchedSwatch = matchedSwatchesList[k];
        var screenColor = matchedSwatch ? matchedSwatch.color : null;

        // Group per line
        var lineGroup = doc.groupItems.add();

        if (isUnderlyBase) {
            // --- UNDERLY BASE: FULL UPPERCASE SINGLE LINE ---
            var baseFrame = doc.textFrames.add();
            baseFrame.contents = ("SCREEN " + screenNum + ". UNDERLY BASE").toUpperCase();
            baseFrame.note = ""; // Clean note
            formatText(baseFrame, screenColor, targetFont, fontSize, fontLeading);

            baseFrame.left = startX;
            baseFrame.top = startY;

            baseFrame.move(lineGroup, ElementPlacement.INSIDE);

        } else {
            // --- COLOR SCREENS: FULL UPPERCASE SPLIT TEXT FRAMES ---
            var rightTextContent = "";
            if (matchedSwatch) {
                var val = screenNum * 10;
                var prefixStr = ((val < 100) ? "0" + val : "" + val) + "-I-";
                rightTextContent = parseSwatchText(matchedSwatch.name, prefixStr).toUpperCase();
            }

            // Left text frame: "SCREEN 1. "
            var leftFrame = doc.textFrames.add();
            leftFrame.contents = ("SCREEN " + screenNum + ". ").toUpperCase();
            leftFrame.note = "";
            formatText(leftFrame, screenColor, targetFont, fontSize, fontLeading);

            leftFrame.left = startX;
            leftFrame.top = startY;

            // Right text frame: "BLACK - BK"
            var rightFrame = doc.textFrames.add();
            rightFrame.contents = rightTextContent;
            formatText(rightFrame, screenColor, targetFont, fontSize, fontLeading);

            var leftBounds = leftFrame.geometricBounds; // [left, top, right, bottom]
            var leftWidth = (leftBounds[2] - leftBounds[0]);
            if (isNaN(leftWidth) || leftWidth <= 0) leftWidth = 110;

            rightFrame.left = startX + leftWidth;
            rightFrame.top = startY;

            // Attribute note applied strictly to color swatch label
            rightFrame.note = "DELETE FOR DTS";

            // Place into line group
            leftFrame.move(lineGroup, ElementPlacement.INSIDE);
            rightFrame.move(lineGroup, ElementPlacement.INSIDE);
        }

        // --- PRECISE BOUNDS VERTICAL SPACING ---
        var currentBounds = lineGroup.geometricBounds; // [left, top, right, bottom]
        var currentTop = currentBounds[1];

        if (k === 0) {
            // Screen 1 remains at initial start position
            previousRowBottom = currentBounds[3];
        } else {
            // Screen N top = Previous row bottom - 0.5 pt
            var targetTop = previousRowBottom - targetGap;
            var shiftY = targetTop - currentTop;

            // Shift entire group to exact target coordinate
            lineGroup.translate(0, shiftY);

            // Record new bottom Y for next iteration
            previousRowBottom = currentBounds[3] + shiftY;
        }
    }

    app.redraw();

    // =========================================================================
    // UI HELPER 1: SWATCH CONFIRMATION POPUP
    // =========================================================================
    function askToRenameSwatch(oldName, newName, screenNum, processVal) {
        var dlg = new Window("dialog", "Underly Base Swatch Confirmation");
        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];
        dlg.spacing = 15;
        dlg.margins = 20;

        // Header Title
        var titleBox = dlg.add("statictext", undefined, "UNDERLY BASE SWATCH MISMATCH");
        setSafeScriptUIFont(titleBox, "dialog", "BOLD", 13);
        titleBox.alignment = ["center", "top"];

        // Context Subtitle
        var subText = dlg.add("statictext", undefined, "Process Selected: X" + processVal + " (SCREEN " + screenNum + ". is Underly Base)");
        setSafeScriptUIFont(subText, "dialog", "REGULAR", 11);
        subText.alignment = ["center", "top"];

        // Comparison Panel
        var card = dlg.add("panel", undefined, " Swatch Details ");
        card.orientation = "column";
        card.alignChildren = ["fill", "top"];
        card.margins = 15;
        card.spacing = 10;

        // Current Swatch Row
        var row1 = card.add("group");
        row1.orientation = "row";
        var lbl1 = row1.add("statictext", undefined, "Current Swatch Name:");
        lbl1.preferredSize.width = 140;
        setSafeScriptUIFont(lbl1, "dialog", "BOLD", 11);
        var val1 = row1.add("statictext", undefined, "\"" + oldName + "\"");

        // Proposed Swatch Row
        var row2 = card.add("group");
        row2.orientation = "row";
        var lbl2 = row2.add("statictext", undefined, "Proposed Swatch Name:");
        lbl2.preferredSize.width = 140;
        setSafeScriptUIFont(lbl2, "dialog", "BOLD", 11);
        var val2 = row2.add("statictext", undefined, "\"" + newName + "\"");
        setSafeScriptUIFont(val2, "dialog", "BOLD", 11);

        // Question
        var prompt = dlg.add("statictext", undefined, "Would you like to change the swatch name to match SCREEN " + screenNum + ".?");
        prompt.alignment = ["center", "top"];

        // Buttons
        var btnGroup = dlg.add("group");
        btnGroup.orientation = "row";
        btnGroup.spacing = 15;
        btnGroup.alignment = ["center", "top"];

        var changeBtn = btnGroup.add("button", undefined, "Change Name");
        changeBtn.size = [130, 35];

        var keepBtn = btnGroup.add("button", undefined, "Keep Original");
        keepBtn.size = [130, 35];

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

    // =========================================================================
    // UI HELPER 2: ERROR POPUP
    // =========================================================================
    function showCustomErrorDialog(titleStr, itemsList, processTag) {
        var dlg = new Window("dialog", titleStr);
        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];
        dlg.spacing = 15;
        dlg.margins = 20;

        // Header Title
        var header = dlg.add("statictext", undefined, "SWATCH ERROR NOTIFICATION");
        setSafeScriptUIFont(header, "dialog", "BOLD", 13);
        header.alignment = ["center", "top"];

        // Info Card
        var card = dlg.add("panel", undefined, " Missing Swatches (" + processTag + ") ");
        card.orientation = "column";
        card.alignChildren = ["left", "top"];
        card.margins = 15;
        card.spacing = 8;

        for (var i = 0; i < itemsList.length; i++) {
            var item = card.add("statictext", undefined, "- " + itemsList[i]);
            setSafeScriptUIFont(item, "dialog", "REGULAR", 11);
        }

        var footerNote = card.add("statictext", undefined, "\nPlease create swatches starting with '010-I-', '020-I-', etc. and try again.");
        setSafeScriptUIFont(footerNote, "dialog", "ITALIC", 10);

        // OK Button
        var okBtn = dlg.add("button", undefined, "OK");
        okBtn.size = [100, 32];
        okBtn.alignment = ["center", "top"];

        okBtn.onClick = function() {
            dlg.close();
        };

        dlg.show();
    }

    // --- HELPER 3: SEARCH FOR UNDERLY BASE SWATCH ---
    function findUnderlyBaseSwatch(document) {
        for (var s = 0; s < document.swatches.length; s++) {
            var swName = document.swatches[s].name.toUpperCase();
            if (swName.indexOf("UNDERLY BASE") !== -1 || swName.indexOf("UNDERY BASE") !== -1) {
                return document.swatches[s];
            }
        }
        return null;
    }

    // --- HELPER 4: MATCH SWATCH PER SCREEN ---
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

    // --- HELPER 5: PARSE INITIAL & COLOUR NAME ---
    function parseSwatchText(swatchName, prefixStr) {
        var text = swatchName;

        if (text.indexOf(prefixStr) === 0) {
            text = text.substring(prefixStr.length);
        }

        text = text.replace(/\s*\([^)]*\)/g, "");
        text = text.replace(/\s+[C|U]$/i, "");
        text = text.replace(/^\s+|\s+$/g, '');

        if (text.indexOf("-") !== -1) {
            var parts = text.split("-");
            if (parts.length >= 2) {
                var initial = parts[0].replace(/^\s+|\s+$/g, '').toUpperCase();
                var colorName = parts.slice(1).join("-").replace(/^\s+|\s+$/g, '').toUpperCase();
                return (colorName + " - " + initial).toUpperCase();
            }
        }

        return text.toUpperCase();
    }

    // --- HELPER 6: DYNAMIC HELVETICA NEUE BOLD FINDER ---
    function getHelveticaNeueBold() {
        try {
            return app.textFonts.getByName("HelveticaNeue-Bold");
        } catch (e) {}

        for (var f = 0; f < app.textFonts.length; f++) {
            var fontName = app.textFonts[f].name;
            if (fontName.indexOf("HelveticaNeue") !== -1 && fontName.indexOf("Bold") !== -1) {
                return app.textFonts[f];
            }
        }

        for (var f2 = 0; f2 < app.textFonts.length; f2++) {
            var fname = app.textFonts[f2].name;
            if (fname.indexOf("Helvetica") !== -1 && fname.indexOf("Bold") !== -1) {
                return app.textFonts[f2];
            }
        }

        return null;
    }

    // --- HELPER 7: FORMAT TEXT SAFELY ---
    function formatText(frame, color, fontObj, size, leading) {
        var tr = frame.textRange;
        tr.characterAttributes.size = size;
        tr.characterAttributes.leading = leading;
        
        if (color) {
            try {
                tr.characterAttributes.fillColor = color;
            } catch (e) {}
        }

        if (fontObj) {
            try {
                tr.characterAttributes.textFont = fontObj;
            } catch (e) {}
        }
    }

    // --- HELPER 8: SAFE SCRIPTUI FONT SETTER ---
    function setSafeScriptUIFont(element, fontType, style, size) {
        try {
            element.graphics.font = ScriptUI.newFont(fontType, style, size);
        } catch (e) {}
    }
})();