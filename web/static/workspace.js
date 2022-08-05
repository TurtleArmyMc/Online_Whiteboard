// Id of current user. Set by server once connected
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
        Socket.send(JSON.stringify(packet));
    },

    getName: function (user) {
        let name = this.names[user];
        return name === undefined ? "Anonymous " + user : name;
    },

    setNames: function (names) {
        this.names = names;
        this.updateNameDisplay();
        this._nameChangeEvent.call(null, null);
    },

    setName: function (user, name) {
        this.names[user] = name;
        this.updateNameDisplay(user, name);
        this._nameChangeEvent.call(user, name);
    },

    updateNameDisplay: function () {
        document.getElementById("name_display").value = this.getName(LocalUserId);
    },

    /** @param {function(?number,?string):void} callback */
    addNameChangeCallback: function (callback) {
        this._nameChangeEvent.register(callback);
    },
};

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

// A layer that can be drawn on
class PaintLayer {
    constructor(id, owner) {
        this.id = id;
        this.owner = owner;

        this.canvas = document.createElement("canvas");
        this.canvas.width = CANVAS_WIDTH;
        this.canvas.height = CANVAS_HEIGHT;
    }

    onSetActive() {
        document.getElementById("paint_layer_controls").style.display = "block";
    }

    drawLine(x1, y1, x2, y2) {
        /** @type {CanvasRenderingContext2D} */
        let ctx = this.canvas.getContext("2d");

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        let minX = Math.min(x1, x2);
        let minY = Math.min(y1, y2);
        let maxX = Math.max(x1, x2);
        let maxY = Math.max(y1, y2);

        // Gives the rectangle enough padding to contain the
        // whole edit, while not being excessively big at the same time
        this.sendDrawPacket(
            minX - (ctx.lineWidth / 1.8) - 2,
            minY - (ctx.lineWidth / 1.8) - 2,
            maxX + (ctx.lineWidth / 1.8) + 2,
            maxY + (ctx.lineWidth / 1.8) + 2
        );
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
        Socket.send(JSON.stringify(packet));
    }

    static type = "paint_layer";
}

class TextLayer {
    constructor(id, owner) {
        this.id = id;
        this.owner = owner;

        this.canvas = document.createElement("canvas");
        this.canvas.width = CANVAS_WIDTH;
        this.canvas.height = CANVAS_HEIGHT;

        this.textInfo = null;
    }

    onSetActive() {
        document.getElementById("text_layer_controls").style.display = "block";
        this.updateTextLayerControls();
    }

    /**
     *
     * @param {Object} textInfo
     * @param {number} textInfo.x
     * @param {number} textInfo.y
     * @param {number} textInfo.font_size
     * @param {string} textInfo.text_content
     */
    setTextInfo(textInfo) {
        this.clearCanvas();

        let ctx = this.canvas.getContext("2d");
        ctx.font = `${textInfo.font_size}px serif`;
        ctx.fillText(textInfo.text_content, textInfo.x, textInfo.y);

        this.textInfo = textInfo;
        if (Layers.activeLayer === this) this.updateTextLayerControls();
    }

    clearCanvas() {
        if (this.textInfo === null) return;
        let ctx = this.canvas.getContext("2d");
        // TODO: Only clear necessary portion of canvas
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    updateTextLayerControls() {
        if (this.textInfo === null) return;
        document.getElementById("text_x").value = this.textInfo.x;
        document.getElementById("text_y").value = this.textInfo.y;
        document.getElementById("text_font_size").value = this.textInfo.font_size;
        document.getElementById("text_content").value = this.textInfo.text_content;
    }

    sendSetInfoPacket(textInfo) {
        let packet = {
            "type": PACKET_TEXT_LAYER_SET,
            "data": {
                text: textInfo,
                layer: this.id,
            },
        };
        Socket.send(JSON.stringify(packet));
    }

    static updateActive() {
        if (!(Layers.activeLayer instanceof TextLayer)) {
            throw 'active layer is not a TextLayer';
        }
        let textInfo = {
            x: Math.floor(document.getElementById("text_x").value),
            y: Math.floor(document.getElementById("text_y").value),
            font_size: Math.floor(document.getElementById("text_font_size").value),
            text_content: document.getElementById("text_content").value,
        };
        Layers.activeLayer.setTextInfo(textInfo);
        Layers.activeLayer.sendSetInfoPacket(textInfo);
    }

    static type = "text_layer";
}

// Used to display layer info and switch between active layers
class LayerSelector {
    constructor(layer) {
        this.layer = layer;
        this.owner = layer.owner;

        this.htmlElement = document.createElement("div");

        this.label = document.createElement("label");
        this.label.innerText = `OWNER: ${Usernames.getName(layer.owner)}`;

        // Only add checkbox and event for selecting layers that user owns
        if (LocalUserId === layer.owner) {
            let checkboxId = `layer_selector_${layer.id}`;
            this.label.setAttribute("for", checkboxId);

            this.checkbox = document.createElement("input");
            this.checkbox.type = "checkbox";
            this.checkbox.id = checkboxId;
            this.checkbox.checked = layer == Layers.activeLayer;
            this.checkbox.onchange = function (e) {
                let checked = this.checked;
                document.getElementById("layer_list").childNodes.forEach(c => c.firstChild.checked = false);
                this.checked = checked;
                Layers.setActiveLayer(checked ? layer : null);
            }
            this.htmlElement.appendChild(this.checkbox);
        }

        this.htmlElement.appendChild(this.label);
    }
}

const Layers = {
    activeLayer: null,
    // Sorted from top to bottom. Height 0 is the top layer
    layers: [],
    idToLayer: {},

    _layersChangeEvent: new EventListener(),

    setActiveLayer: function (layer) {
        [...document.getElementsByClassName("layer_controls")].forEach(e => e.style.removeProperty("display"));
        layer.onSetActive && layer.onSetActive();
        this.activeLayer = layer;
    },

    // Gets layer with id if type matches
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

    // Draw all layer canvases and layer selectors
    displayLayers: function () {
        let mainDisplay = document.getElementById("main_display");
        // Topmost children must come last
        mainDisplay.replaceChildren(...this.layers.map(layer => layer.canvas).reverse());

        let layerSelector = document.getElementById("layer_list");
        layerSelector.replaceChildren(...this.layers.map(layer => new LayerSelector(layer).htmlElement));
    },

    // Can be called locally or prompted by server
    deleteLayer: function (id) {
        let layer = this.idToLayer[id];
        if (layer != undefined) {
            delete this.idToLayer[id];
            this.layers.splice(this.layers.findIndex(l => l.id === id), 1);
            if (this.activeLayer.id === id) this.activeLayer = null;

            this._layersChangeEvent.call();
        }
    },

    // Requests server to delete layer. Done to prevent desync between heights
    // on client and server
    deleteActiveLayer: function () {
        if (this.activeLayer != null) {
            let packet = {
                'type': PACKET_C2S_DELETE_LAYER,
                'data': this.activeLayer.id,
            };
            Socket.send(JSON.stringify(packet));
        }
    },

    // Requests server to create new layer of type
    sendCreatePacket: function (type) {
        let packet = {
            'type': PACKET_C2S_CREATE_LAYER,
            'data': type,
        };
        Socket.send(JSON.stringify(packet));
    },

    /** @param {function():void} callback */
    addLayerChangeCallback(callback) {
        this._layersChangeEvent.register(callback);
    },
};
Layers.addLayerChangeCallback(Layers.displayLayers.bind(Layers));
// Layers selectors must be redrawn to display owner names correctly when a
// name is changed
Usernames.addNameChangeCallback((user, name) => Layers.displayLayers(null, null));

/** @type {WebSocket} */
var Socket;
{
    let url = new URL('/ws', window.location.href);
    url.protocol = url.protocol.replace('http', 'ws');
    Socket = new WebSocket(url.href);
}
window.onclose = (_) => Socket.close();

/** @param {Uint8ClampedArray} array */
const uint8ToBase64 = function (array) {
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
const base64ToUint8 = function (s) {
    let decoded = atob(s);
    let array = new Uint8ClampedArray(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
        array[i] = decoded.charCodeAt(i);
    }
    return array;
}
/**
 * Encodes image data into base 64 to allow for JSON serialization
 * @param {ImageData} image
 */
const encodeImageData = function (image) {
    return {
        width: image.width,
        height: image.height,
        data: uint8ToBase64(image.data)
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
        base64ToUint8(img.data),
        img.width,
        img.height
    );
}

// Maps layer type names to their class
const LayerTypes = {
    [PaintLayer.type]: PaintLayer,
    [TextLayer.type]: TextLayer,
};

// Packet types
const PACKET_SET_USER_ID = "set_uid";
const PACKET_MAP_USERNAMES = "map_usernames";
const PACKET_SET_USERNAME = "set_username";
const PACKET_C2S_CREATE_LAYER = "c2s_create_layer";
const PACKET_S2C_CREATE_LAYER = "s2c_create_layer";
const PACKET_C2S_DELETE_LAYER = "c2s_delete_layer";
const PACKET_S2C_DELETE_LAYER = "s2c_delete_layer";
const PACKET_PAINT_LAYER_SET = "paint_layer_set";
const PACKET_PAINT_LAYER_DRAW = "paint_layer_draw";
const PACKET_TEXT_LAYER_SET = "text_layer_set";

// Handle received packets
const S2CPacketHandlers = {
    [PACKET_SET_USER_ID]: data => LocalUserId = data,

    [PACKET_MAP_USERNAMES]: Usernames.setNames.bind(Usernames),

    [PACKET_SET_USERNAME]: data => Usernames.setName(data.id, data.name),

    [PACKET_S2C_CREATE_LAYER]: data => {
        let constructor = LayerTypes[data.layer_type];
        if (constructor === undefined) {
            throw (`error: unknown layer type "${data.layer_type}"`);
        }
        let layer = new constructor(data.id, data.owner);
        // Automatically select new layer if no layer is currently selected
        if (Layers.activeLayer === null && layer.owner === LocalUserId) Layers.setActiveLayer(layer);
        Layers.insertLayer(data.height, layer);
    },

    [PACKET_S2C_DELETE_LAYER]: Layers.deleteLayer.bind(Layers),

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

    [PACKET_TEXT_LAYER_SET]: data => {
        Layers.getChecked(data.layer, TextLayer).setTextInfo(data.text);
    },
}

// Reads and handles incoming messages from the server
Socket.onmessage = function (e) {
    let msg = JSON.parse(e.data);
    let t = msg.type;
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
    findEdits() {
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
 * Converts click into corresponding coordinates on a canvas
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

// A generic brush for editing paint layers
class Brush {
    /** @param {string} [compositeOperation=source-over] */
    constructor(compositeOperation) {
        this.compositeOperation = compositeOperation === undefined ? "source-over" : compositeOperation;
    }

    static COLOR = "#000000"
    static SIZE = 15

    // Updates brush settings from sliders
    static updateSettings() {
        this.COLOR = `rgb(
            ${Math.floor(document.getElementById("red").value)},
            ${Math.floor(document.getElementById("green").value)},
            ${Math.floor(document.getElementById("blue").value)}
        )`;
        this.SIZE = document.getElementById("brush_size").value;
        document.getElementById("color_preview").style.backgroundColor = this.COLOR;
    }

    drawDot(x, y) {
        this.drawLine(x, y, x, y);
    }

    drawLine(x1, y1, x2, y2) {
        if (!(Layers.activeLayer instanceof PaintLayer)) return;

        /** @type {CanvasRenderingContext2D} */
        let ctx = Layers.activeLayer.canvas.getContext("2d");

        // Set canvas settings before draw
        ctx.globalCompositeOperation = this.compositeOperation;
        ctx.strokeStyle = Brush.COLOR;
        ctx.lineWidth = Brush.SIZE;
        ctx.lineCap = "round";

        Layers.activeLayer.drawLine(x1, y1, x2, y2);
    }

    onmousedown(e) {
        let pos = getCanvasPos(e, Layers.activeLayer.canvas);
        if (pos != null) this.drawDot(pos.x, pos.y);
    }

    onmouseup(e) {
        let pos = getCanvasPos(e, Layers.activeLayer.canvas);
        if (pos != null) this.drawDot(pos.x, pos.y);
    }

    /** @param {MouseEvent} e */
    onmousemove(e) {
        let mouseDown = !!(e.buttons & 1);
        if (mouseDown) {
            let pos = getCanvasPos(e, Layers.activeLayer.canvas);
            if (pos != null) {
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
// Updates to current slider settings and updates color preview display
Brush.updateSettings();

// Tools are used to handle how mouse events should affect the canvas
const Tools = {
    PEN: new Brush(),
    ERASER: new Brush("destination-out"),
};

// The global current tool. Initialized from tool dropdown chooser
var CurrentTool = Tools[document.getElementById("tool_select").value];

// Create handlers to call current tool functions on mouse events
{
    let mainDisplay = document.getElementById("main_display");
    mainDisplay.onmousedown = (e) => CurrentTool && CurrentTool.onmousedown && CurrentTool.onmousedown(e);
    mainDisplay.onmouseup = (e) => CurrentTool && CurrentTool.onmouseup && CurrentTool.onmouseup(e);
    mainDisplay.onmouseleave = (e) => CurrentTool && CurrentTool.onmouseleave && CurrentTool.onmouseleave(e);
    mainDisplay.onmousemove = (e) => CurrentTool && CurrentTool.onmousemove && CurrentTool.onmousemove(e);
}