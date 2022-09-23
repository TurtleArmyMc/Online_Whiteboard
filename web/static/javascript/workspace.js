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
        this._nameChangeEvent.call();
    },

    setName: function (user, name) {
        this.names[user] = name;
        this.updateNameDisplay();
        this._nameChangeEvent.call();
    },

    updateNameDisplay: function () {
        document.getElementById("name_display").value = this.getName(LocalUserId);
    },

    /** @param {function():void} callback */
    addNameChangeCallback: function (callback) {
        this._nameChangeEvent.register(callback);
    },
};

const OnlineUsers = {
    users: new Set(),

    _onlineChangeEvent: new EventListener(),

    set(users) {
        this.users = new Set(users);
        this.updateOnlineUserDisplay();
    },

    // Displays online users in the top right corner of the screen
    updateOnlineUserDisplay() {
        let sortedUsers = [...this.users].sort();

        document.getElementById("online_user_list").replaceChildren(
            ...sortedUsers.filter(uid => uid != LocalUserId).map(uid => {
                let div = document.createElement("div");
                div.innerText = Usernames.getName(uid);
                return div;
            }
            ));
    },

    /** @param {function():void} callback */
    addOnlineChangeCallback: function (callback) {
        this._onlineChangeEvent.register(callback);
    },
}
Usernames.addNameChangeCallback(OnlineUsers.updateOnlineUserDisplay.bind(OnlineUsers));

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

// A layer that can be drawn on
class PaintLayer {
    constructor(id, owner, name) {
        this.id = id;
        this.owner = owner;
        this.name = name;

        this.canvas = document.createElement("canvas");
        this.canvas.width = CANVAS_WIDTH;
        this.canvas.height = CANVAS_HEIGHT;

        this.displayIconUrl = "/icons/palette_black_24dp.svg";
    }

    showLayerControls() {
        if (this.owner === LocalUserId) {
            document.getElementById("paint_layer_controls").style.display = "block";
            // Set current tool to currently selected paint tool
            for (let radio of document.getElementsByName("paint_tool_select")) {
                if (radio.checked) {
                    Tools.setCurrent(Tools.tool[radio.value]);
                    break;
                }
            }
        }
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
    constructor(id, owner, name) {
        this.id = id;
        this.owner = owner;
        this.name = name;

        this.canvas = document.createElement("canvas");
        this.canvas.width = CANVAS_WIDTH;
        this.canvas.height = CANVAS_HEIGHT;

        this.textInfo = null;

        this.displayIconUrl = "/icons/text_fields_black_24dp.svg"
    }

    showLayerControls() {
        if (this.owner === LocalUserId) {
            document.getElementById("text_layer_controls").style.display = "block";
            Tools.setCurrent(Tools.tool.move);
            this.updateTextLayerControls();
        }
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

    move(deltaX, deltaY) {
        // FIXME: Rounding can cause text to drift away from the cursor
        this.textInfo.x = Math.round(this.textInfo.x + deltaX);
        this.textInfo.y = Math.round(this.textInfo.y + deltaY);
        this.setTextInfo(this.textInfo);
        this.sendSetInfoPacket(this.textInfo);
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
        this.htmlElement.className = "layer_selector";
        if (layer.owner === 0) {
            this.htmlElement.classList.add("unowned_layer_selector");
        } else if (layer.owner === LocalUserId) {
            this.htmlElement.classList.add("owned_layer_selector");
        }

        this.label = document.createElement("label");
        let labelIcon = document.createElement("img");
        labelIcon.src = layer.displayIconUrl;
        this.label.appendChild(labelIcon);

        let labelDisplay = document.createElement("div");

        let layerNameDisplay = document.createElement("div");
        layerNameDisplay.className = "layer_name_display";
        layerNameDisplay.innerText = layer.name;
        labelDisplay.appendChild(layerNameDisplay);

        let labelOwnerDisplay = document.createElement("div");
        labelOwnerDisplay.className = "layer_owner_display";
        labelOwnerDisplay.innerText = layer.owner != 0 ? Usernames.getName(layer.owner) : "Unowned layer";
        labelDisplay.appendChild(labelOwnerDisplay);

        this.label.appendChild(labelDisplay);

        let radioId = `layer_selector_${layer.id}`;
        this.label.setAttribute("for", radioId);

        this.radio = document.createElement("input");
        this.radio.name = "selected_layer";
        this.radio.type = "radio";
        this.radio.id = radioId;
        this.radio.checked = layer == Layers.activeLayer;
        this.radio.onchange = (e) => Layers.setActiveLayer(this.radio.checked ? layer : null);

        this.htmlElement.appendChild(this.radio);
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
        this.activeLayer = layer;
        this.updateControls();
    },

    updateControls: function () {
        HUD.clear();

        // Hide layer controls
        [...document.getElementsByClassName("layer_controls")].forEach(e => e.style.removeProperty("display"));

        if (this.activeLayer === null || this.activeLayer.owner != LocalUserId) {
            Tools.setCurrent(null);
        }
        if (this.activeLayer != null) {
            // Show generic layer controls
            if (this.activeLayer.owner === 0) {
                document.getElementById("layer_unowned_controls").style.display = "block";
            } else if (this.activeLayer.owner === LocalUserId) {
                document.getElementById("layer_owner_controls").style.display = "block";
                document.getElementById("layer_name_editor").value = this.activeLayer.name;
            }
            // Show layer specific controls
            this.activeLayer.showLayerControls && this.activeLayer.showLayerControls();
        }
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

    _removeLayer: function (id) {
        delete this.idToLayer[id];
        this.layers.splice(this.layers.findIndex(l => l.id === id), 1);
    },

    setHeight: function (id, height) {
        let layer = this.idToLayer[id];
        this._removeLayer(id);
        this.insertLayer(height, layer);
    },

    // Draw all layer canvases and layer selectors
    displayLayers: function () {
        let canvasDisplay = document.getElementById("canvas_display");
        // Topmost children must come last
        canvasDisplay.replaceChildren(...this.layers.map(layer => layer.canvas).reverse());
        // Put HUD on top
        canvasDisplay.appendChild(HUD.canvas);

        let layerSelector = document.getElementById("layer_list");
        layerSelector.replaceChildren(...this.layers.map(layer => new LayerSelector(layer).htmlElement));
    },

    // Can be called locally or prompted by server
    deleteLayer: function (id) {
        let layer = this.idToLayer[id];
        if (layer != undefined) {
            this._removeLayer(id);
            if (this.activeLayer && this.activeLayer.id === id) {
                this.setActiveLayer(null);
            }

            this._layersChangeEvent.call();
        }
    },

    // Requests server to delete layer. Done to prevent desync between heights
    // on client and server
    requestDeleteActiveLayer: function () {
        if (this.activeLayer != null && this.activeLayer.owner === LocalUserId) {
            let packet = {
                'type': PACKET_C2S_DELETE_LAYER,
                'data': this.activeLayer.id,
            };
            Socket.send(JSON.stringify(packet));
        }
    },

    requestMoveActiveLayer: function (moveBy) {
        if (this.activeLayer != null && this.activeLayer.owner === LocalUserId) {
            let packet = {
                'type': PACKET_C2S_MOVE_LAYER,
                'data': {
                    layer: this.activeLayer.id,
                    move_by: moveBy,
                },
            };
            Socket.send(JSON.stringify(packet));
        }
    },

    setLayerOwner: function (layerId, newOwner) {
        this.idToLayer[layerId].owner = newOwner;
        if (this.activeLayer && this.activeLayer.id == layerId) {
            this.updateControls();
        }
        this._layersChangeEvent.call();
    },

    setLayerName: function (layerId, newName) {
        this.idToLayer[layerId].name = newName;
        if (this.activeLayer != null && this.activeLayer.id === layerId && this.activeLayer.owner === LocalUserId) {
            // Update name changer if name change received from somewhere other
            // than the name changer
            let layerNameChanger = document.getElementById("layer_name_editor");
            if (layerNameChanger.value != newName) layerNameChanger.value = newName;
        }
        this._layersChangeEvent.call();
    },

    setActiveLayerName: function (name) {
        if (this.activeLayer === null || this.activeLayer.owner != LocalUserId) return;
        this.setLayerName(this.activeLayer.id, name);
        let packet = {
            'type': PACKET_SET_LAYER_NAME,
            'data': {
                'layer': this.activeLayer.id,
                'new_name': name,
            },
        };
        Socket.send(JSON.stringify(packet));

    },

    requestFreeActiveLayer: function () {
        if (this.activeLayer != null && this.activeLayer.owner === LocalUserId) {
            let packet = {
                'type': PACKET_SET_LAYER_OWNER,
                'data': {
                    layer: this.activeLayer.id,
                    new_owner: 0,
                },
            };
            Socket.send(JSON.stringify(packet));
        }
    },

    requestClaimActiveLayer: function () {
        if (this.activeLayer != null && this.activeLayer.owner === 0) {
            let packet = {
                'type': PACKET_SET_LAYER_OWNER,
                'data': {
                    layer: this.activeLayer.id,
                    new_owner: LocalUserId,
                },
            };
            Socket.send(JSON.stringify(packet));
        }
    },

    requestCreate: function (type) {
        // Deselect current layer so that new layer will be automatically
        // selected when created
        this.setActiveLayer(null);
        this.sendCreatePacket(type);
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
Usernames.addNameChangeCallback(Layers.displayLayers.bind(Layers));

// Displayed on top of all layers for custom cursor
const HUD = {
    canvas: document.createElement("canvas"),
    _dirtyX: 0,
    _dirtyY: 0,
    _dirtyWidth: 0,
    _dirtyHeight: 0,

    clear: function () {
        if (this._dirtyWidth == 0 || this._dirtyHeight == 0) return;
        this.canvas.getContext("2d").clearRect(this._dirtyX, this._dirtyY, this._dirtyWidth, this._dirtyHeight);
        this._dirtyWidth = 0;
        this._dirtyHeight = 0;
    },

    drawCircle: function (x, y, radius) {
        this.clear();

        let ctx = this.canvas.getContext("2d");
        const circleWidth = 1;
        ctx.lineWidth = circleWidth;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.stroke();
        this._dirtyX = x - radius - circleWidth;
        this._dirtyY = y - radius - circleWidth;
        this._dirtyWidth = 2 * (radius + circleWidth);
        this._dirtyHeight = 2 * (radius + circleWidth);
    }
};
HUD.canvas.id = "hud";
HUD.canvas.width = CANVAS_WIDTH;
HUD.canvas.height = CANVAS_HEIGHT;

/** @type {WebSocket} */
var Socket;
{
    let path = window.location.href;
    if (path.charAt(path.length - 1) != '/') path = path + '/';
    path = path + "ws";
    let url = new URL(path);
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
const PACKET_SET_ONLINE_USERS = "set_online_users";
const PACKET_SET_LAYER_OWNER = "set_layer_owner";
const PACKET_SET_LAYER_NAME = "set_layer_name";
const PACKET_C2S_CREATE_LAYER = "c2s_create_layer";
const PACKET_S2C_CREATE_LAYER = "s2c_create_layer";
const PACKET_C2S_DELETE_LAYER = "c2s_delete_layer";
const PACKET_S2C_DELETE_LAYER = "s2c_delete_layer";
const PACKET_C2S_MOVE_LAYER = "c2s_move_layer";
const PACKET_S2C_LAYER_SET_HEIGHT = "s2c_set_layer_height";
const PACKET_PAINT_LAYER_SET = "paint_layer_set";
const PACKET_PAINT_LAYER_DRAW = "paint_layer_draw";
const PACKET_TEXT_LAYER_SET = "text_layer_set";

// Handle received packets
const S2CPacketHandlers = {
    [PACKET_SET_USER_ID]: data => LocalUserId = data,

    [PACKET_MAP_USERNAMES]: Usernames.setNames.bind(Usernames),

    [PACKET_SET_USERNAME]: data => Usernames.setName(data.id, data.name),

    [PACKET_SET_ONLINE_USERS]: OnlineUsers.set.bind(OnlineUsers),

    [PACKET_SET_LAYER_OWNER]: data => Layers.setLayerOwner(data.layer, data.new_owner),

    [PACKET_SET_LAYER_NAME]: data => Layers.setLayerName(data.layer, data.new_name),

    [PACKET_S2C_CREATE_LAYER]: data => {
        let constructor = LayerTypes[data.layer_type];
        if (constructor === undefined) {
            throw (`error: unknown layer type "${data.layer_type}"`);
        }
        let layer = new constructor(data.id, data.owner, data.name);
        // Automatically select new layer if no layer is currently selected
        if (Layers.activeLayer === null && layer.owner === LocalUserId) Layers.setActiveLayer(layer);
        Layers.insertLayer(data.height, layer);
    },

    [PACKET_S2C_DELETE_LAYER]: Layers.deleteLayer.bind(Layers),

    [PACKET_S2C_LAYER_SET_HEIGHT]: data => Layers.setHeight(data.layer, data.height),

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

/** @param {MouseEvent} e */
const leftMouseDown = (e) => !!(e.buttons & 1);

// A generic brush for editing paint layers
class Brush {
    /** @param {string} [compositeOperation=source-over] */
    constructor(compositeOperation) {
        // Default to brushes being for drawing over the canvas contents
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
        if (Layers.activeLayer.owner != LocalUserId) return;

        /** @type {CanvasRenderingContext2D} */
        let ctx = Layers.activeLayer.canvas.getContext("2d");

        // Set canvas settings before draw
        ctx.globalCompositeOperation = this.compositeOperation;
        ctx.strokeStyle = Brush.COLOR;
        ctx.lineWidth = Brush.SIZE;
        ctx.lineCap = "round";

        Layers.activeLayer.drawLine(x1, y1, x2, y2);
    }

    onSelect() {
        // Use custom circle cursor
        document.getElementById("hud").style.cursor = "none";
    }

    onmousedown(e) {
        if (!leftMouseDown(e)) return;
        let pos = getCanvasPos(e, Layers.activeLayer.canvas);
        if (pos != null) this.drawDot(pos.x, pos.y);
    }

    onmouseup(e) {
        if (!leftMouseDown(e)) return;
        let pos = getCanvasPos(e, Layers.activeLayer.canvas);
        if (pos != null) this.drawDot(pos.x, pos.y);
    }

    /** @param {MouseEvent} e */
    onmouseleave(e) {
        HUD.clear();
    }

    /** @param {MouseEvent} e */
    onmousemove(e) {
        let pos = getCanvasPos(e, Layers.activeLayer.canvas);

        // Draw brush cursor
        HUD.drawCircle(pos.x, pos.y, Brush.SIZE / 2);

        if (leftMouseDown(e)) {
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

const MoveTool = {
    onSelect() {
        document.getElementById("hud").style.cursor = "move";
    },

    /** @param {MouseEvent} e */
    onmousemove(e) {
        if (leftMouseDown(e) && Layers.activeLayer instanceof TextLayer && Layers.activeLayer.owner === LocalUserId) {
            let move = getCanvasPos(e, Layers.activeLayer.canvas);
            Layers.activeLayer.move(move.movementX, move.movementY);
        }
    }
}

// Tools are used to handle how mouse events should affect the canvas
const Tools = {
    tool: {
        pen: new Brush(),
        eraser: new Brush("destination-out"),
        move: MoveTool,
    },

    // Initialized from tool dropdown chooser
    _current: null,

    setCurrent: function (tool) {
        this._current = tool;
        if (tool == null) {
            // Use mouse for canvas cursor
            document.getElementById("hud").style.cursor = "auto";
        } else if (tool.onSelect) {
            tool.onSelect();
        }
    },

    getCurrent: function () {
        return this._current;
    }
};

// Create handlers to call current tool functions on mouse events
{
    let canvasDisplay = document.getElementById("canvas_display");
    canvasDisplay.onmousedown = (e) => Tools.getCurrent() && Tools.getCurrent().onmousedown && Tools.getCurrent().onmousedown(e);
    canvasDisplay.onmouseup = (e) => Tools.getCurrent() && Tools.getCurrent().onmouseup && Tools.getCurrent().onmouseup(e);
    canvasDisplay.onmouseleave = (e) => Tools.getCurrent() && Tools.getCurrent().onmouseleave && Tools.getCurrent().onmouseleave(e);
    canvasDisplay.onmousemove = (e) => Tools.getCurrent() && Tools.getCurrent().onmousemove && Tools.getCurrent().onmousemove(e);
}