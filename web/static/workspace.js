/** @type {HTMLCanvasElement} */
let mainDisplay = document.getElementById("main_display");
mainDisplay.imageSmoothingEnabled = false;

let url = new URL('/ws', window.location.href);
url.protocol = url.protocol.replace('http', 'ws');
let socket = new WebSocket(url.href);
// socket.binaryType = "arraybuffer";

/**
 * @param {ImageData} imageData
 * @returns {Object}
 */
var imageDataToB64 = function (imageData) {
    // TODO: TEST
    let d = btoa(String.fromCharCode.apply(null, imageData.data));;
    return {
        width: imageData.width,
        height: imageData.height,
        data: d
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

const PACKET_PAINT_LAYER_SET = "paint_layer_set";
const PACKET_PAINT_LAYER_DRAW = "paint_layer_draw";
var PacketHandler = {
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

/** @argument {MessageEvent<string>} e */
socket.onmessage = function (e) {
    let msg = JSON.parse(e.data);
    let t = msg.type;
    let h = PacketHandler[t];
    h && h(msg.data);
}

/**
 * Used to find a rectangle containing all changed pixels in a paint, and sync
 * only that rectangle to the backend
 * @property {HTMLCanvasElement} layer
*/
class PaintLayerEdit {
    /** @argument {HTMLCanvasElement} layer */
    constructor(layer) {
        this.layer = layer;
        this.prevData = layer.getContext("2d").getImageData(0, 0, layer.width, layer.height);
    }

    sync = () => {
        let ctx = this.layer.getContext("2d");
        let currData = ctx.getImageData(0, 0, this.layer.width, this.layer.height);

        let maxX = -1;
        let maxY = -1;
        let minX = this.layer.width;
        let minY = this.layer.height;

        let bytesWidth = currData.width * 4;
        currData.data.forEach((value, inx) => {
            if (value != this.prevData.data[inx]) {
                let row = Math.floor(inx / bytesWidth);
                let col = Math.floor((inx % bytesWidth) / 4);

                maxX = Math.max(maxX, col);
                maxY = Math.max(maxY, row);
                minX = Math.min(minX, col);
                minY = Math.min(minY, row);
            }
        })

        // Check if any changes were found
        if (maxX == -1) return;

        let width = maxX - minX + 1;
        let height = maxY - minY + 1;
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
}

document.getElementById("testFill").onclick = function (e) {
    console.log("TEST");
    let edit = new PaintLayerEdit(mainDisplay);
    let ctx = mainDisplay.getContext("2d");
    ctx.fillRect(0, 1, 1, 1);
    edit.sync();
}

var PenTool = {
    drawDot: function (x, y) {
        this.drawLine(x, y, x, y);
    },

    drawLine: function (x1, y1, x2, y2) {
        let edit = new PaintLayerEdit(mainDisplay);

        let ctx = mainDisplay.getContext("2d");
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineWidth = 1;
        ctx.lineTo(x2, y2);
        ctx.closePath();
        ctx.stroke();

        edit.sync();
    },

    onmousedown: function (e) {
        this.drawDot(e.clientX, e.clientY);
    },

    onmousemove: function (e, lastX, lastY, mouseDown) {
        if (mouseDown) {
            this.drawLine(lastX, lastY, e.clientX, e.clientY);
        }
    }
}

var CurrentTool = PenTool;

var MouseManager = {
    mouseDown: false,
    lastX: 0,
    lastY: 0,

    onmousedown: function (e) {
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.mouseDown = true;
        CurrentTool && CurrentTool.onmousedown && CurrentTool.onmousedown(e);
    },

    onmouseup: function (e) {
        this.mouseDown = false;
        CurrentTool && CurrentTool.onmouseup && CurrentTool.onmouseup(e);
        this.lastX = e.clientX;
        this.lastY = e.clientY;
    },

    onmouseenter: function (e) {
        CurrentTool && CurrentTool.onmouseenter && CurrentTool.onmouseenter(e);
    },

    onmouseleave: function (e) {
        CurrentTool && CurrentTool.onmouseleave && CurrentTool.onmouseleave(e);
        this.mouseDown = false;
    },

    onmousemove: function (e) {
        CurrentTool && CurrentTool.onmousemove && CurrentTool.onmousemove(e, this.lastX, this.lastY, this.mouseDown);
        this.lastX = e.clientX;
        this.lastY = e.clientY;
    },
}

mainDisplay.onmousedown = MouseManager.onmousedown;
mainDisplay.onmouseup = MouseManager.onmouseup;
mainDisplay.onmouseleave = MouseManager.onmouseleave;
mainDisplay.onmousemove = MouseManager.onmousemove;
