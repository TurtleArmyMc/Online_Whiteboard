var LocalUserId = 0;

class EventListener {
    constructor(callbacks) {
        this._callbacks = new Set(callbacks);
    }

    register(callback) {
        this._callbacks.add(callback);
    }

    call(val) {
        this._callbacks.forEach(callback => callback(val));
    }
}

const Usernames = {
    names: {},
    _nameChangeEvent: new EventListener(),

    setLocalName: function (name) {
        this.setName(LocalUserId, name);
        let packet = {
            'type': PACKET_SET_NAME,
            'data': {
                'id': LocalUserId,
                'name': name,
            },
        };
        socket.send(JSON.stringify(packet));
    },

    getName: function (user) {
        let name = this.names[user];
        return name === undefined ? "Anonymous " + user : name;
    },

    setNames: function (names) {
        this.names = names;
        this.updateNameDisplay(null, null);
        this._nameChangeEvent.call(null, null);
    },

    setName: function (user, name) {
        this.names[user] = name;
        this.updateNameDisplay(user, name);
        this._nameChangeEvent.call(user, name);
    },

    updateNameDisplay: function (..._) {
        document.getElementById("name_display").value = this.getName(LocalUserId);
    },

    /** @param {function(?number,?string):void} callback */
    addNameChangeCallback: function (callback) {
        this._nameChangeEvent.register(callback);
    },
};

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

class PaintLayer {
    constructor(id, owner) {
        this.id = id;
        this.owner = owner;

        this.canvas = document.createElement("canvas");
        this.canvas.width = CANVAS_WIDTH;
        this.canvas.height = CANVAS_HEIGHT;
    }

    sendDrawPacket(minX, minY, maxX, maxY) {
        // Make sure coords are within bounds
        minX = Math.max(Math.floor(minX), 0);
        minY = Math.max(Math.floor(minY), 0);
        maxX = Math.min(Math.ceil(maxX), this.canvas.width - 1);
        maxY = Math.min(Math.ceil(maxY), this.canvas.height - 1);

        let width = maxX - minX + 1;
        let height = maxY - minY + 1;
        let ctx = this.canvas.getContext("2d");
        let imgData = ctx.getImageData(minX, minY, width, height);
        let packet = {
            "type": PACKET_PAINT_LAYER_DRAW,
            "data": {
                "pos": { "x": minX, "y": minY },
                "image": encodeImageData(imgData),
                "layer": this.id,
            },
        };
        socket.send(JSON.stringify(packet));
    }

    static type = "paint_layer";
};

const Layers = {
    activeLayer: undefined,
    layers: [],
    idToLayer: {},

    _layerAddEvent: new EventListener(),

    getChecked: function (id, type) {
        let layer = this.idToLayer[id];
        if (layer === undefined) throw `no layer with id ${id}`;
        if (!(type === undefined) && !(layer instanceof type)) throw `layer ${id} is not a ${type.name}`;
        return layer;
    },

    insertLayer: function (height, layer) {
        this.layers.splice(height, 0, layer);
        this.idToLayer[layer.id] = layer;
        this.displayLayers(layer, height);
        this._layerAddEvent.call(layer, height);
    },

    activeLayerHeight: function () {
        for (let i = 0; i < this.layers.length; i++) {
            if (this.layers[i] == this.activeLayer) return i;
        }
        return -1;
    },

    displayLayers: function (changedLayer, changeHeight) {
        let mainDisplay = document.getElementById("main_display");
        mainDisplay.replaceChildren(...this.layers.map(layer => layer.canvas));

        let layerSelector = document.getElementById("layer_selector");
        layerSelector.replaceChildren(...this.layers.map(layer => {
            let p = document.createElement("p");
            p.innerText = "ID: " + layer.id + " OWNER: " + Usernames.getName(layer.owner);
            return p;
        }));
    },

    /** @param {function(?Layer, ?height):void} callback */
    addLayerAddCallback(callback) {
        this._layerAddEvent.register(callback);
    },
};
Usernames.addNameChangeCallback((user, name) => Layers.displayLayers(null, null));

const LayerTypes = {
    [PaintLayer.type]: PaintLayer
};

/** @type {WebSocket} */
var socket;
{
    let url = new URL('/ws', window.location.href);
    url.protocol = url.protocol.replace('http', 'ws');
    socket = new WebSocket(url.href);
}
window.onclose = (_) => socket.close();

/** @param {Uint8ClampedArray} array */
const uint8ToB64 = array => btoa(String.fromCharCode.apply(null, array));

/** @param {string} s */
const b64ToUint8 = s => new Uint8ClampedArray(atob(s).split("").map((c) => c.charCodeAt(0)));

/** @param {ImageData} image */
const encodeImageData = function (image) {
    return {
        width: image.width,
        height: image.height,
        data: uint8ToB64(image.data)
    };
}

/**
 * @param {Object} img
 * @param {string} img.data
 * @param {number} img.width
 * @param {number} img.height
 */
const decodeImageData = function (img) {
    return new ImageData(
        b64ToUint8(img.data),
        img.width,
        img.height
    );
}

// Packet types
const PACKET_SET_USER_ID = "set_uid";
const PACKET_MAP_NAMES = "map_names";
const PACKET_SET_NAME = "set_name";
const PACKET_CREATE_LAYER = "create_layer";
const PACKET_PAINT_LAYER_SET = "paint_layer_set";
const PACKET_PAINT_LAYER_DRAW = "paint_layer_draw";

// Handle received packets
const PacketHandlers = {
    [PACKET_SET_USER_ID]: data => LocalUserId = data,

    [PACKET_MAP_NAMES]: data => Usernames.setNames(data),

    [PACKET_SET_NAME]: data => Usernames.setName(data.id, data.name),

    [PACKET_CREATE_LAYER]: data => {
        let constructor = LayerTypes[data.layer_type];
        if (constructor === undefined) {
            console.log("error: unknown layer type `" + data.layer_type + "`");
            return
        }
        let layer = new constructor(data.id, data.owner);
        Layers.insertLayer(data.height, layer);

        if (layer.owner == LocalUserId) Layers.activeLayer = layer;
    },

    [PACKET_PAINT_LAYER_SET]: data => {
        let layer = Layers.getChecked(data.layer, PaintLayer);
        let imageData = decodeImageData(data.image);
        let ctx = layer.canvas.getContext("2d");
        ctx.putImageData(imageData, 0, 0);
    },

    [PACKET_PAINT_LAYER_DRAW]: data => {
        let layer = Layers.getChecked(data.layer, PaintLayer);
        let imageData = decodeImageData(data.image);
        let ctx = layer.canvas.getContext("2d");
        ctx.putImageData(imageData, data.pos.x, data.pos.y);
    },
}

// Reads incoming messages
socket.onmessage = function (e) {
    let msg = JSON.parse(e.data);
    let t = msg.type;
    console.log(t);
    let h = PacketHandlers[t];
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
        this.prevImage = layer.canvas.getContext("2d").getImageData(0, 0, layer.width, layer.height);
    }

    // Find rectangle in which image was changed
    findEdits = () => {
        let ctx = this.layer.canvas.getContext("2d");
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
 * @param {number} layerHeight
 * @param {number} minX
 * @param {number} minY
 * @param {number} maxX
 * @param {number} maxY
*/

/**
 * @param {MouseEvent} e
 * @param {HTMLCanvasElement} [canvas]
 */
const getCanvasPos = function (e, canvas) {
    if (canvas === undefined) return null;
    let r = canvas.getBoundingClientRect();
    let xScale = canvas.width / r.width;
    let yScale = canvas.height / r.height;
    return {
        x: (e.clientX - r.left) * xScale,
        y: (e.clientY - r.top) * yScale,
        movementX: e.movementX * xScale,
        movementY: e.movementY * yScale,
    };
}

// Tools are used to handle how mouse events should affect the canvas
const Tools = {
    COLOR: "#000000", // Global color for all tools
    BRUSH_SIZE: 15, // Global brush size for all tools

    updateColor: function () {
        console.log(this.COLOR);
        this.COLOR = `rgb(
            ${Math.floor(document.getElementById("red").value)},
            ${Math.floor(document.getElementById("green").value)},
            ${Math.floor(document.getElementById("blue").value)}
        )`;
        this.BRUSH_SIZE = document.getElementById("brush_size").value;
        document.getElementById("color_preview").style.backgroundColor = this.COLOR;
    },

    Pen: {
        drawDot: function (x, y) {
            this.drawLine(x, y, x, y);
        },

        // TODO: Fix short lines appearing jagged
        drawLine: function (x1, y1, x2, y2) {
            if (!Layers.activeLayer instanceof PaintLayer) return;
            /** @type {CanvasRenderingContext2D} */
            let ctx = Layers.activeLayer.canvas.getContext("2d");

            ctx.strokeStyle = Tools.COLOR;

            // TODO: Allow user to adjust width
            ctx.lineWidth = Tools.BRUSH_SIZE;
            ctx.lineCap = "round";

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.closePath();
            ctx.stroke();

            let minX = Math.min(x1, x2);
            let minY = Math.min(y1, y2);
            let maxX = Math.max(x1, x2);
            let maxY = Math.max(y1, y2);

            Layers.activeLayer.sendDrawPacket(
                minX - ctx.lineWidth - 2,
                minY - ctx.lineWidth - 2,
                maxX + ctx.lineWidth + 2,
                maxY + ctx.lineWidth + 2
            );
        },

        onmousedown: function (e) {
            let pos = getCanvasPos(e, Layers.activeLayer.canvas);
            if (pos != undefined) this.drawDot(pos.x, pos.y);
        },

        onmouseup: function (e) {
            let pos = getCanvasPos(e, Layers.activeLayer.canvas);
            if (pos != undefined) this.drawDot(pos.x, pos.y);
        },

        /** @param {MouseEvent} e */
        onmousemove: function (e) {
            let mouseDown = !!(e.buttons & 1);
            if (mouseDown) {
                let pos = getCanvasPos(e, Layers.activeLayer.canvas);
                if (pos != undefined) {
                    this.drawLine(
                        pos.x - pos.movementX,
                        pos.y - pos.movementY,
                        pos.x,
                        pos.y
                    );
                }
            }
        }
    }
};
Tools.updateColor(); // Sets preview color window

// The global current tool
var CurrentTool = Tools.Pen;

{
    let mainDisplay = document.getElementById("main_display");
    mainDisplay.onmousedown = (e) => CurrentTool && CurrentTool.onmousedown && CurrentTool.onmousedown(e);
    mainDisplay.onmouseup = (e) => CurrentTool && CurrentTool.onmouseup && CurrentTool.onmouseup(e);
    mainDisplay.onmouseleave = (e) => CurrentTool && CurrentTool.onmouseleave && CurrentTool.onmouseleave(e);
    mainDisplay.onmousemove = (e) => CurrentTool && CurrentTool.onmousemove && CurrentTool.onmousemove(e);
}