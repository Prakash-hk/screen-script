#target illustrator

(function generateScreenLabelsUI() {
    if (app.documents.length === 0) {
        showCustomErrorDialog("No Document Open", ["Please open an Illustrator document first!"], "SYSTEM");
        return;
    }

    var doc = app.activeDocument;
    var selectedType = null; // 'X' or 'P'
    var selectedVal = null;  // 1 through 10

    // Cache Font
    var targetFont = getPreferredFont();

    // --- 1. SCRIPT UI WINDOW (MAIN SELECTOR) ---
    var win = new Window("dialog", "Screen Process Generator");
    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.spacing = 15;
    win.margins = 20;

    var header = win.add("group");
    header.orientation = "column";
    header.alignChildren = ["center", "top"];
    var title = header.add("statictext", undefined, "SELECT PROCESS METHOD");
    setSafeScriptUIFont(title, "dialog", "BOLD", 14);

    // --- PANEL 1: X PROCESS (WITH UNDERLAY BASE) ---
    var panelX = win.add("panel", undefined, "X Process ( Includes Underlay Base )");
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

    // --- PANEL 2: P PROCESS (WITHOUT UNDERLAY BASE) ---
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

    var cancelBtn = win.add("button", undefined, "Cancel");
    cancelBtn.size = [100, 32];
    cancelBtn.alignment = ["center", "top"];
    cancelBtn.onClick = function() {
        win.close();
    };

    win.show();

    if (selectedType === null || selectedVal === null) return; // User canceled

    // --- X2 PROCESS HOLD CHECK ---
    if (selectedType === 'X' && selectedVal === 2) {
        showWorkInProcessDialog("X2 Process");
        return; // STOP execution for X2
    }

    var hasUnderlyBase = (selectedType === 'X');
    var totalScreens = hasUnderlyBase ? (selectedVal + 1) : selectedVal;
    var missingSwatches = [];
    var matchedSwatchesList = [];
    var extraBaseSwatches = [];

    // --- 2. VALIDATE PMS COLOR SWATCHES FIRST ---
    var colorScreensCount = hasUnderlyBase ? (totalScreens - 1) : totalScreens;

    for (var c = 0; c < colorScreensCount; c++) {
        var screenNumC = c + 1;
        var colorSw = findSwatchForScreen(doc, screenNumC, false);

        if (!colorSw) {
            var valC = screenNumC * 10;
            var prefixStrC = (valC < 100) ? "0" + valC : "" + valC;
            missingSwatches.push("SCREEN " + screenNumC + " -> Missing swatch starting with '" + prefixStrC + "-I-'");
        } else {
            matchedSwatchesList.push(colorSw);
        }
    }

    if (missingSwatches.length > 0) {
        showCustomErrorDialog("Missing Color Swatches", missingSwatches, selectedType + selectedVal);
        return;
    }

    // --- 3. HANDLE UNDERLAY BASE SWATCH ---
    if (hasUnderlyBase) {
        var underlyScreenNum = totalScreens;
        var expectedUnderlyVal = underlyScreenNum * 10;
        var expectedUnderlyPrefix = (expectedUnderlyVal < 100 ? "0" + expectedUnderlyVal : "" + expectedUnderlyVal) + "-";
        var expectedBaseName = expectedUnderlyPrefix + "Underlay Base";

        var baseSwatches = findUnderlyBaseSwatches(doc, underlyScreenNum);

        if (baseSwatches.length === 0) {
            var createdBase = createUnderlayBaseSwatch(doc, expectedBaseName);
            matchedSwatchesList.push(createdBase);
        } else {
            var primaryBase = baseSwatches[0];

            if (primaryBase.name.indexOf(expectedUnderlyPrefix) !== 0 || /UNDERLA?Y\s*BASE/i.test(primaryBase.name) === false) {
                var shouldChange = askToRenameSwatch(primaryBase.name, expectedBaseName, underlyScreenNum, selectedVal);
                if (shouldChange) {
                    renameSwatchSafely(primaryBase, expectedBaseName);
                }
            }

            matchedSwatchesList.push(primaryBase);

            if (baseSwatches.length > 1) {
                extraBaseSwatches = baseSwatches.slice(1);
            }
        }
    }

    // --- 4. TARGET OR CREATE 'INFO' LAYER ---
    var targetLayer;
    try {
        targetLayer = doc.layers.getByName("INFO");
    } catch (e) {
        targetLayer = doc.layers.add();
        targetLayer.name = "INFO";
    }
    targetLayer.locked = false;
    targetLayer.visible = true;

    // --- 5. FETCH "G01-" OR "GARMENT" SWATCH FOR BACKGROUND BOX ---
    var garmentSwatch = findGarmentSwatch(doc);

    // --- 6. GENERATE LAYOUT ---
    var abIndex = doc.artboards.getActiveArtboardIndex();
    var abBounds = doc.artboards[abIndex].artboardRect;

    var startX = abBounds[0] + (9.5 * 72); // 9.5 inches = 684 pt
    var startY = abBounds[1] - (1.5 * 72); // 1.5 inches = 108 pt
    
    var fontSize = 18;          
    var fontLeading = 17.2128;  
    var rowStep = 17.2128;      

    for (var k = 0; k < totalScreens; k++) {
        var screenNum = k + 1;
        var currentY = startY - (k * rowStep);
        var isUnderlyBase = hasUnderlyBase && (k === totalScreens - 1);

        var matchedSwatch = matchedSwatchesList[k];
        var screenColor = matchedSwatch ? matchedSwatch.color : null;
        var isWhite = isWhiteSwatch(matchedSwatch);

        var lineGroup = targetLayer.groupItems.add();

        if (isUnderlyBase) {
            // --- REGULAR UNDERLAY BASE OUTPUT ---
            var baseFrame = lineGroup.textFrames.add();
            var baseLabel = matchedSwatch ? getUnderlayBaseLabel(matchedSwatch.name) : "UNDERLAY BASE";

            baseFrame.contents = ("SCREEN " + screenNum + ". " + baseLabel).toUpperCase();
            baseFrame.note = "";
            formatText(baseFrame, screenColor, targetFont, fontSize, fontLeading);

            baseFrame.left = startX;
            baseFrame.top = currentY;

            // ADD SPOT COLOR UNGROUPED BOX IF SCREEN IS WHITE
            if (isWhite) {
                var bBounds = baseFrame.geometricBounds;
                createFitBox(garmentSwatch, bBounds[0], bBounds[1], bBounds[2], bBounds[3]);
            }

        } else {
            // --- REGULAR COLOR SCREEN OUTPUT ---
            var rightTextContent = "";
            if (matchedSwatch) {
                rightTextContent = parseSwatchText(matchedSwatch.name).toUpperCase();
            }

            var leftFrame = lineGroup.textFrames.add();
            leftFrame.contents = ("SCREEN " + screenNum + ". ").toUpperCase();
            leftFrame.note = "";
            formatText(leftFrame, screenColor, targetFont, fontSize, fontLeading);

            leftFrame.left = startX;
            leftFrame.top = currentY;

            var rightFrame = lineGroup.textFrames.add();
            rightFrame.contents = rightTextContent.toUpperCase();
            formatText(rightFrame, screenColor, targetFont, fontSize, fontLeading);

            var leftWidth = 108; 
            try {
                var leftBounds = leftFrame.geometricBounds;
                leftWidth = (leftBounds[2] - leftBounds[0]);
                if (isNaN(leftWidth) || leftWidth <= 0) leftWidth = 108;
            } catch (err) {}

            rightFrame.left = startX + leftWidth;
            rightFrame.top = currentY;

            rightFrame.note = "DELETE FOR DTS";

            // ADD SPOT COLOR UNGROUPED BOX IF SCREEN IS WHITE
            if (isWhite) {
                var lB = leftFrame.geometricBounds;
                var rB = rightFrame.geometricBounds;
                var combinedLeft = lB[0];
                var combinedTop = Math.max(lB[1], rB[1]);
                var combinedRight = rB[2];
                var combinedBottom = Math.min(lB[3], rB[3]);

                createFitBox(garmentSwatch, combinedLeft, combinedTop, combinedRight, combinedBottom);
            }
        }
    }

    // --- 7. DRAW DOTTED LINE AND EXTRA BASE SWATCHES ---
    if (hasUnderlyBase && extraBaseSwatches.length > 0) {
        var baseScreenNum = totalScreens;
        var lastY = startY - ((totalScreens - 1) * rowStep);
        var lineY = lastY - (rowStep * 0.7);

        var sepLine = targetLayer.pathItems.add();
        sepLine.setEntirePath([[startX, lineY], [startX + 350, lineY]]);
        sepLine.filled = false;
        sepLine.stroked = true;

        var greyColor = new RGBColor();
        greyColor.red = 150;
        greyColor.green = 150;
        greyColor.blue = 150;
        sepLine.strokeColor = greyColor;
        sepLine.strokeWidth = 0.75;
        sepLine.dashArray = [2, 2];

        var extraRowY = lineY - (rowStep * 0.6);
        var currentX = startX;

        var extraGroup = targetLayer.groupItems.add();

        for (var b = 0; b < extraBaseSwatches.length; b++) {
            var extraSw = extraBaseSwatches[b];
            var extraLabel = getUnderlayBaseLabel(extraSw.name);
            var isExtraWhite = isWhiteSwatch(extraSw);

            var exFrame = extraGroup.textFrames.add();
            exFrame.contents = ("SCREEN " + baseScreenNum + ". " + extraLabel).toUpperCase();
            exFrame.note = "";
            formatText(exFrame, extraSw.color, targetFont, fontSize, fontLeading);

            exFrame.left = currentX;
            exFrame.top = extraRowY;

            var frameWidth = 160;
            try {
                var frameBounds = exFrame.geometricBounds;
                frameWidth = (frameBounds[2] - frameBounds[0]);
                if (isNaN(frameWidth) || frameWidth <= 0) frameWidth = 160;

                if (isExtraWhite) {
                    createFitBox(garmentSwatch, frameBounds[0], frameBounds[1], frameBounds[2], frameBounds[3]);
                }
            } catch (err) {}

            currentX += frameWidth + 25; 
        }
    }

    app.redraw();

    // =========================================================================
    // WHITE BOX & SWATCH HELPERS
    // =========================================================================

    function findGarmentSwatch(document) {
        for (var i = 0; i < document.swatches.length; i++) {
            var sw = document.swatches[i];
            var swNameUpper = sw.name.toUpperCase();
            
            // Matches "G01-" prefix OR any swatch with "GARMENT" in the name
            if (swNameUpper.indexOf("G01-") === 0 || swNameUpper.indexOf("GARMENT") !== -1) {
                return sw;
            }
        }
        return null;
    }

    function isWhiteSwatch(swatchObj) {
        if (!swatchObj) return false;
        var swNameUpper = swatchObj.name.toUpperCase();

        if (swNameUpper.indexOf("WHITE") !== -1) {
            return true;
        }

        var col = swatchObj.color;
        if (col.typename === "SpotColor") {
            col = col.spot.color;
        }

        if (col.typename === "CMYKColor") {
            return (col.cyan === 0 && col.magenta === 0 && col.yellow === 0 && col.black === 0);
        } else if (col.typename === "RGBColor") {
            return (col.red === 255 && col.green === 255 && col.blue === 255);
        } else if (col.typename === "GrayColor") {
            return (col.gray === 0);
        }

        return false;
    }

    function createFitBox(boxSwatch, left, top, right, bottom) {
        if (!boxSwatch) {
            // Guard against process color fallback
            return;
        }

        var boxHeight = 0.2213 * 72; // FIXED HEIGHT: 0.2213 in (15.9336 pt)
        var boxWidth = right - left;  // Flush left & right text alignment

        // Visual Center Offset Calibration for 18pt Point Text
        var capTop = top - 1.2;
        var baseline = bottom + 3.5;
        var textCenterY = (capTop + baseline) / 2;

        var boxTop = textCenterY + (boxHeight / 2);
        var boxLeft = left;

        // Draw box DIRECTLY on targetLayer (UNGROUPED)
        var box = targetLayer.pathItems.rectangle(boxTop, boxLeft, boxWidth, boxHeight);
        box.stroked = false;
        box.filled = true;
        
        // Assigns Spot Color swatch directly
        box.fillColor = boxSwatch.color;

        // Set DTS Attribute
        box.note = "DELETE FOR DTS";

        box.zOrder(ZOrderMethod.SENDTOBACK);
    }

    // =========================================================================
    // DIALOGS & OTHER HELPERS
    // =========================================================================

    function showWorkInProcessDialog(processName) {
        var dlg = new Window("dialog", processName + " - Under Process");
        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];
        dlg.spacing = 15;
        dlg.margins = 20;

        var header = dlg.add("statictext", undefined, "WORK IN PROCESS");
        setSafeScriptUIFont(header, "dialog", "BOLD", 13);
        header.alignment = ["center", "top"];

        var card = dlg.add("panel", undefined, " Status Notice ");
        card.orientation = "column";
        card.alignChildren = ["center", "top"];
        card.margins = 18;
        card.spacing = 10;

        var msg1 = card.add("statictext", undefined, processName + " method is currently ON HOLD.");
        setSafeScriptUIFont(msg1, "dialog", "BOLD", 11);

        var msg2 = card.add("statictext", undefined, "Updates for this process method are under construction.");
        setSafeScriptUIFont(msg2, "dialog", "REGULAR", 11);

        var okBtn = dlg.add("button", undefined, "OK");
        okBtn.size = [100, 32];
        okBtn.alignment = ["center", "top"];

        okBtn.onClick = function() {
            dlg.close();
        };

        dlg.show();
    }

    function askToRenameSwatch(oldName, newName, screenNum, processVal) {
        var dlg = new Window("dialog", "Underlay Base Swatch Confirmation");
        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];
        dlg.spacing = 15;
        dlg.margins = 20;

        var titleBox = dlg.add("statictext", undefined, "UNDERLAY BASE SWATCH MISMATCH");
        setSafeScriptUIFont(titleBox, "dialog", "BOLD", 13);
        titleBox.alignment = ["center", "top"];

        var subText = dlg.add("statictext", undefined, "Process Selected: X" + processVal + " (SCREEN " + screenNum + ". is Underlay Base)");
        setSafeScriptUIFont(subText, "dialog", "REGULAR", 11);
        subText.alignment = ["center", "top"];

        var card = dlg.add("panel", undefined, " Swatch Details ");
        card.orientation = "column";
        card.alignChildren = ["fill", "top"];
        card.margins = 15;
        card.spacing = 10;

        var row1 = card.add("group");
        row1.orientation = "row";
        var lbl1 = row1.add("statictext", undefined, "Current Swatch Name:");
        lbl1.preferredSize.width = 140;
        setSafeScriptUIFont(lbl1, "dialog", "BOLD", 11);
        var val1 = row1.add("statictext", undefined, "\"" + oldName + "\"");

        var row2 = card.add("group");
        row2.orientation = "row";
        var lbl2 = row2.add("statictext", undefined, "Proposed Swatch Name:");
        lbl2.preferredSize.width = 140;
        setSafeScriptUIFont(lbl2, "dialog", "BOLD", 11);
        var val2 = row2.add("statictext", undefined, "\"" + newName + "\"");
        setSafeScriptUIFont(val2, "dialog", "BOLD", 11);

        var prompt = dlg.add("statictext", undefined, "Would you like to change the swatch name to match SCREEN " + screenNum + ".?");
        prompt.alignment = ["center", "top"];

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

    function showCustomErrorDialog(titleStr, itemsList, processTag) {
        var dlg = new Window("dialog", titleStr);
        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];
        dlg.spacing = 15;
        dlg.margins = 20;

        var header = dlg.add("statictext", undefined, "SWATCH ERROR NOTIFICATION");
        setSafeScriptUIFont(header, "dialog", "BOLD", 13);
        header.alignment = ["center", "top"];

        var card = dlg.add("panel", undefined, " Missing Swatches (" + processTag + ") ");
        card.orientation = "column";
        card.alignChildren = ["left", "top"];
        card.margins = 15;
        card.spacing = 8;

        for (var i = 0; i < itemsList.length; i++) {
            var item = card.add("statictext", undefined, "- " + itemsList[i]);
            setSafeScriptUIFont(item, "dialog", "REGULAR", 11);
        }

        var footerNote = card.add("statictext", undefined, "\nPlease verify color swatches start with '010-I-'");
        setSafeScriptUIFont(footerNote, "dialog", "ITALIC", 10);

        var okBtn = dlg.add("button", undefined, "OK");
        okBtn.size = [100, 32];
        okBtn.alignment = ["center", "top"];

        okBtn.onClick = function() {
            dlg.close();
        };

        dlg.show();
    }

    function renameSwatchSafely(swatchObj, newName) {
        try {
            if (swatchObj.color && swatchObj.color.typename === "SpotColor") {
                swatchObj.color.spot.name = newName;
            } else {
                swatchObj.name = newName;
            }
        } catch (e) {
            try {
                swatchObj.name = newName;
            } catch (err) {}
        }
    }

    function createUnderlayBaseSwatch(document, swatchName) {
        var spot;
        try {
            spot = document.spots.getByName(swatchName);
        } catch (e) {
            spot = document.spots.add();
            spot.name = swatchName; 
        }

        spot.colorType = ColorModel.SPOT;

        var cmykColor = new CMYKColor();
        cmykColor.cyan = 6.16;
        cmykColor.magenta = 25.62;
        cmykColor.yellow = 10.65;
        cmykColor.black = 0;

        spot.color = cmykColor;

        try {
            return document.swatches.getByName(swatchName);
        } catch (err) {
            for (var i = 0; i < document.swatches.length; i++) {
                if (document.swatches[i].name === swatchName) {
                    return document.swatches[i];
                }
            }
        }
        return null;
    }

    function findUnderlyBaseSwatches(document, screenNum) {
        var val = screenNum * 10;
        var numPrefix = (val < 100) ? "0" + val : "" + val;
        var foundBases = [];

        for (var s = 0; s < document.swatches.length; s++) {
            var sw = document.swatches[s];
            var swNameUpper = sw.name.toUpperCase();
            
            var hasPrefix = (swNameUpper.indexOf(numPrefix + "-") === 0);
            var isBase = (swNameUpper.indexOf("UNDERLAY BASE") !== -1 || 
                          swNameUpper.indexOf("UNDERLY BASE") !== -1 || 
                          swNameUpper.indexOf("UNDERY BASE") !== -1);

            if (hasPrefix && isBase) {
                foundBases.push(sw);
            }
        }

        if (foundBases.length === 0) {
            for (var j = 0; j < document.swatches.length; j++) {
                var sw2 = document.swatches[j];
                var nameUpper = sw2.name.toUpperCase();
                if (nameUpper.indexOf("UNDERLAY BASE") !== -1 || 
                    nameUpper.indexOf("UNDERLY BASE") !== -1 || 
                    nameUpper.indexOf("UNDERY BASE") !== -1) {
                    foundBases.push(sw2);
                }
            }
        }

        return foundBases;
    }

    function findSwatchForScreen(document, screenNum, isUnderlyBase) {
        if (isUnderlyBase) {
            var bases = findUnderlyBaseSwatches(document, screenNum);
            return (bases.length > 0) ? bases[0] : null;
        }

        var val = screenNum * 10;
        var numPrefix = (val < 100) ? "0" + val : "" + val;

        for (var s = 0; s < document.swatches.length; s++) {
            var sw = document.swatches[s];
            var swNameUpper = sw.name.toUpperCase();
            
            if (swNameUpper.indexOf(numPrefix + "-I-") === 0) {
                return sw;
            }
        }
        return null;
    }

    function getUnderlayBaseLabel(swatchName) {
        var upper = swatchName.toUpperCase();
        
        if (/UNDERLA?Y\s*BASE/i.test(upper)) {
            return "UNDERLAY BASE";
        }
        
        return parseSwatchText(swatchName);
    }

    function parseSwatchText(swatchName) {
        var text = swatchName;

        text = text.replace(/^[0-9]{3}[-_I\s]*/i, "");
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

    function getPreferredFont() {
        try {
            return app.textFonts.getByName("HelveticaNeue-Bold");
        } catch (e) {}

        try {
            return app.textFonts.getByName("MyriadPro-Bold");
        } catch (e) {}

        for (var f = 0; f < app.textFonts.length; f++) {
            var fontName = app.textFonts[f].name;
            if (fontName.indexOf("Helvetica") !== -1 || fontName.indexOf("Myriad") !== -1) {
                return app.textFonts[f];
            }
        }

        return null;
    }

    function formatText(frame, color, fontObj, size, leading) {
        var tr = frame.textRange;
        tr.characterAttributes.size = size;
        tr.characterAttributes.leading = leading;

        try {
            tr.characterAttributes.tracking = 0;
        } catch (e) {}

        try {
            tr.characterAttributes.autoKerning = AutoKerningType.OPTICAL;
        } catch (e) {}
        
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

    function setSafeScriptUIFont(element, fontType, style, size) {
        try {
            element.graphics.font = ScriptUI.newFont(fontType, style, size);
        } catch (e) {}
    }
})();