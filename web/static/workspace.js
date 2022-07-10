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
            'type': PACKET_SET_USERNAME,
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
}

class LayerSelector {
    constructor(layer) {
        this.layer = layer;
        this.owner = layer.owner;

        this.htmlElement = document.createElement("div");

        let checkboxId = `layer_selector_${layer.id}`;

        this.checkbox = document.createElement("input");
        this.checkbox.type = "checkbox";
        this.checkbox.id = checkboxId;
        let enabled = LocalUserId === layer.owner;
        this.checkbox.disabled = !enabled;
        if (enabled) {
            this.checkbox.checked = layer == Layers.activeLayer;
            this.checkbox.onchange = function (e) {
                let checked = this.checked;
                document.getElementById("layer_list").childNodes.forEach(c => c.firstChild.checked = false);
                this.checked = checked;
                Layers.activeLayer = checked ? layer : null;
            }
        }
        this.htmlElement.appendChild(this.checkbox);

        this.label = document.createElement("label");
        this.label.setAttribute("for", checkboxId);
        this.label.innerText = `OWNER: ${Usernames.getName(layer.owner)}`;
        this.htmlElement.appendChild(this.label);
    }
}

const Layers = {
    activeLayer: null,
    layers: [],
    idToLayer: {},

    _layersChangeEvent: new EventListener(),

    getChecked: function (id, type) {
        let layer = this.idToLayer[id];
        if (layer === null) throw `no layer with id ${id}`;
        if (!(type === undefined) && !(layer instanceof type)) throw `layer ${id} is not a ${type.name}`;
        return layer;
    },

    insertLayer: function (height, layer) {
        this.layers.splice(height, 0, layer);
        this.idToLayer[layer.id] = layer;

        this._layersChangeEvent.call();
    },

    activeLayerHeight: function () {
        for (let i = 0; i < this.layers.length; i++) {
            if (this.layers[i] == this.activeLayer) return i;
        }
        return -1;
    },

    displayLayers: function () {
        let mainDisplay = document.getElementById("main_display");
        mainDisplay.replaceChildren(...this.layers.map(layer => layer.canvas));

        let layerSelector = document.getElementById("layer_list");
        layerSelector.replaceChildren(...this.layers.map(layer => new LayerSelector(layer).htmlElement).reverse());
    },

    deleteLayer: function (id) {
        let layer = this.idToLayer[id];
        if (layer != undefined) {
            delete this.idToLayer[id];
            this.layers.splice(this.layers.findIndex(l => l.id === id), 1);
            if (this.activeLayer.id === id) this.activeLayer = null;

            this._layersChangeEvent.call();
        }
    },

    deleteActiveLayer: function () {
        if (this.activeLayer != null) {
            let packet = {
                'type': PACKET_DELETE_LAYER,
                'data': this.activeLayer.id,
            };
            this.deleteLayer(this.activeLayer.id);
            socket.send(JSON.stringify(packet));
        }
    },

    sendCreatePacket: function(type) {
        let packet = {
            'type': PACKET_C2S_CREATE_LAYER,
            'data': type,
        };
        socket.send(JSON.stringify(packet));
    },

    /** @param {function():void} callback */
    addLayerChangeCallback(callback) {
        this._layersChangeEvent.register(callback);
    },
};
Layers.addLayerChangeCallback(Layers.displayLayers.bind(Layers));
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
const uint8ToB64 = function (array) {
    // Array is converted to a string because btoa expects one.
    // Array is converted in several steps to avoid hitting the maximum
    // argument limit for js functions when calling apply when serializing
    // larger images.
    // array.map is too slow to be an alternative here
    const step = 65536 - 1;
    let s = [];
    for (let i = 0; i < array.length; i += step) {
        s.push(String.fromCharCode.apply(null, array.slice(i, i + step)));
    }
    return btoa(s.join(''));
}

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
const PACKET_MAP_USERNAMES = "map_usernames";
const PACKET_SET_USERNAME = "set_username";
const PACKET_C2S_CREATE_LAYER = "c2s_create_layer";
const PACKET_S2C_CREATE_LAYER = "s2c_create_layer";
const PACKET_DELETE_LAYER = "delete_layer";
const PACKET_PAINT_LAYER_SET = "paint_layer_set";
const PACKET_PAINT_LAYER_DRAW = "paint_layer_draw";

// Handle received packets
const S2CPacketHandlers = {
    [PACKET_SET_USER_ID]: data => LocalUserId = data,

    [PACKET_MAP_USERNAMES]: data => Usernames.setNames(data),

    [PACKET_SET_USERNAME]: data => Usernames.setName(data.id, data.name),

    [PACKET_S2C_CREATE_LAYER]: data => {
        let constructor = LayerTypes[data.layer_type];
        if (constructor === undefined) {
            console.log("error: unknown layer type `" + data.layer_type + "`");
            return
        }
        let layer = new constructor(data.id, data.owner);
        if (Layers.activeLayer === null && layer.owner === LocalUserId) Layers.activeLayer = layer;
        Layers.insertLayer(data.height, layer);
    },

    [PACKET_DELETE_LAYER]: Layers.deleteLayer.bind(Layers),

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
    let h = S2CPacketHandlers[t];
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
            if (!(Layers.activeLayer instanceof PaintLayer)) return;
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

            // Gives the rectangle enough padding to contain the
            // whole edit, while not being excessively big at the same time
            Layers.activeLayer.sendDrawPacket(
                minX - (ctx.lineWidth / 1.8) - 2,
                minY - (ctx.lineWidth / 1.8) - 2,
                maxX + (ctx.lineWidth / 1.8) + 2,
                maxY + (ctx.lineWidth / 1.8) + 2
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
    mainDisplay.onmousedown = (e) => Layers.activeLayer && CurrentTool && CurrentTool.onmousedown && CurrentTool.onmousedown(e);
    mainDisplay.onmouseup = (e) => Layers.activeLayer && CurrentTool && CurrentTool.onmouseup && CurrentTool.onmouseup(e);
    mainDisplay.onmouseleave = (e) => Layers.activeLayer && CurrentTool && CurrentTool.onmouseleave && CurrentTool.onmouseleave(e);
    mainDisplay.onmousemove = (e) => Layers.activeLayer && CurrentTool && CurrentTool.onmousemove && CurrentTool.onmousemove(e);
}