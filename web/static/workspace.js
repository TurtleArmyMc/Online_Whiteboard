/** @type {HTMLCanvasElement} */
var mainDisplay = document.getElementById("main_display");

/** @type {WebSocket} */
var socket;
{
    let url = new URL('/ws', window.location.href);
    url.protocol = url.protocol.replace('http', 'ws');
    socket = new WebSocket(url.href);
}
window.onclose = (_) => socket.close();

/**
 * @param {ImageData} image
 * @returns {Object}
 */
var imageDataToB64 = function (image) {
    let imageData = btoa(String.fromCharCode.apply(null, image.data));;
    return {
        width: image.width,
        height: image.height,
        data: imageData
    };
}

/**
 * @param {Object} img
 * @param {string} img.data
 * @param {number} img.width
 * @param {number} img.height
 * @returns {ImageData}
 */
var b64ToImageData = function (img) {
    let data = new Uint8ClampedArray(atob(img.data).split("").map((c) => c.charCodeAt(0)));
    return new ImageData(
        data,
        img.width,
        img.height
    );
}

// Packet types
const PACKET_PAINT_LAYER_SET = "paint_layer_set";
const PACKET_PAINT_LAYER_DRAW = "paint_layer_draw";

// Handle received packets
const PacketHandler = {
    /** @argument {Uint8ClampedArray} data */
    [PACKET_PAINT_LAYER_SET]: (data) => {
        let imageData = b64ToImageData(data.image);
        let ctx = mainDisplay.getContext("2d");
        ctx.putImageData(imageData, 0, 0);
    },

    /** @argument {Uint8ClampedArray} data */
    [PACKET_PAINT_LAYER_DRAW]: (data) => {
        let imageData = b64ToImageData(data.image);
        let ctx = mainDisplay.getContext("2d");
        ctx.putImageData(imageData, data.pos.x, data.pos.y);
    },
}

// Reads incoming messages
socket.onmessage = function (e) {
    let msg = JSON.parse(e.data);
    let t = msg.type;
    let h = PacketHandler[t];
    if (!!h) {
        h(msg.data);
    } else {
        console.log("error: unknown packet type `" + t + "`");
    }
}

/**
 * Used to find a rectangle containing all changed pixels in a paint
 * @property {HTMLCanvasElement} layer
*/
class EditBoundTracker {
    /** @argument {HTMLCanvasElement} layer */
    constructor(layer) {
        this.layer = layer;
        this.prevImage = layer.getContext("2d").getImageData(0, 0, layer.width, layer.height);
    }

    // Find rectangle in which image was changed
    findEdits = () => {
        let ctx = this.layer.getContext("2d");
        let currImage = ctx.getImageData(0, 0, this.layer.width, this.layer.height);

        let maxX = -1;
        let maxY = -1;
        let minX = this.layer.width;
        let minY = this.layer.height;

        let bytesWidth = currImage.width * 4;
        let currData = currImage.data;
        let prevData = this.prevImage.data;
        for (let i = 0; i < currImage.data.length; i++) {
            if (currData[i] != prevData[i]) {
                let row = Math.floor(i / bytesWidth);
                let col = Math.floor((i % bytesWidth) / 4);

                maxX = Math.max(maxX, col);
                maxY = Math.max(maxY, row);
                minX = Math.min(minX, col);
                minY = Math.min(minY, row);
            }
        }

        // Check if any changes were found
        if (maxX == -1) return null;
        return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
    }
}

/**
 * @param {HTMLCanvasElement} layer
 * @param {number} minX
 * @param {number} minY
 * @param {number} maxX
 * @param {number} maxY
*/
const SyncPaintLayerEdit = function (layer, minX, minY, maxX, maxY) {
    // Make sure coords are within bounds
    minX = Math.max(minX, 0);
    minY = Math.max(minY, 0);
    maxX = Math.min(maxX, mainDisplay.width - 1);
    maxY = Math.min(maxY, mainDisplay.height - 1);

    let width = maxX - minX + 1;
    let height = maxY - minY + 1;
    let ctx = layer.getContext("2d");
    let imgData = ctx.getImageData(minX, minY, width, height);
    let packet = {
        "type": PACKET_PAINT_LAYER_DRAW,
        "data": {
            "pos": { "x": minX, "y": minY },
            "image": imageDataToB64(imgData),
        },
    };
    socket.send(JSON.stringify(packet));
}

// Tools are used to handle how mouse events should affect the canvas
const Tools = {
    Pen: {
        drawDot: function (x, y) {
            this.drawLine(x, y, x, y);
        },

        // TODO: Fix short lines appearing jagged
        drawLine: function (x1, y1, x2, y2) {
            let ctx = mainDisplay.getContext("2d");
            // TODO: Allow user to adjust width
            ctx.lineWidth = 15;
            ctx.lineCap = "round";

            // Center line on cursor
            // FIXME: Does not work well, especially for different line widths
            x1 -= Math.ceil(ctx.lineWidth * 0.5);
            x2 -= Math.ceil(ctx.lineWidth * 0.5);
            y1 -= Math.ceil(ctx.lineWidth * 0.5);
            y2 -= Math.ceil(ctx.lineWidth * 0.5);

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.closePath();
            ctx.stroke();

            let minX = Math.min(x1, x2);
            let minY = Math.min(y1, y2);
            let maxX = Math.max(x1, x2);
            let maxY = Math.max(y1, y2);

            SyncPaintLayerEdit(
                mainDisplay,
                minX - ctx.lineWidth - 2,
                minY - ctx.lineWidth - 2,
                maxX + ctx.lineWidth + 2,
                maxY + ctx.lineWidth + 2
            );
        },

        onmousedown: function (e) {
            this.drawDot(e.layerX, e.layerY);
        },

        onmouseup: function (e) {
            this.drawDot(e.layerX, e.layerY);
        },

        /** @param {MouseEvent} e */
        onmousemove: function (e) {
            let mouseDown = !!(e.buttons & 1);
            if (mouseDown) {
                this.drawLine(e.layerX - e.movementX, e.layerY - e.movementY, e.layerX, e.layerY);
            }
        }
    }
}

// The global current tool
var CurrentTool = Tools.Pen;


mainDisplay.onmousedown = function (e) { CurrentTool && CurrentTool.onmousedown && CurrentTool.onmousedown(e); };
mainDisplay.onmouseup = function (e) { CurrentTool && CurrentTool.onmouseup && CurrentTool.onmouseup(e); };
mainDisplay.onmouseleave = function (e) { CurrentTool && CurrentTool.onmouseleave && CurrentTool.onmouseleave(e); };
mainDisplay.onmousemove = function (e) { CurrentTool && CurrentTool.onmousemove && CurrentTool.onmousemove(e); };
