// TODO split source code into modules
// TODO split layer into multiple when there are more than 2 interconnected nodes in a layer
// TODO enhance error handling

const sampleGraph0 = `
8 11
1000 100 100 200 200 200 200 2000
0 1 800
0 2 200
1 3 100
1 5 100
2 4 100
2 5 100
2 6 500
3 7 200
4 7 200
5 7 200
6 7 200
`;

const inactiveClassName = 'inactive';

const notBlank = (s) => s.length > 0;
const convertToNumbers = (s) => s.split(' ').filter(notBlank).map(Number);

function unitVector(x1, y1, x2, y2) {
    let a = x2 - x1;
    let b = y2 - y1;
    let v = Math.sqrt(a * a + b * b);

    let ua = a / v;
    let ub = b / v;
    return [ua, ub];
}

/* register handlers for toolbar buttons */
const toolbarButtonActiveClassName = 'toolbar-button--active';
[...document.querySelectorAll('.toolbar-button')].forEach(item => {
    item.addEventListener('click', (e) => {
        if (e.target != item) return;
        item.classList.toggle(toolbarButtonActiveClassName);

        window.addEventListener('click', function butonDisabler(event) {
            if (item.contains(event.target)) return;

            item.classList.remove(toolbarButtonActiveClassName);
            window.removeEventListener('click', butonDisabler);
        });
    });
});

/**
 * Parse description of a residual graph from a string
 * 
 * Given a string with description of a residual graph this function parses it
 * and forms a graph object from it. Given graph should be directed, weighted
 * and also should have node restictions on it.
 * 
 * Graph description format:
 * First line should contain two space separated numbers - N and M, that
 * represents the number of nodes and edges in this grah. The next line should
 * contain N numbers that represent node restictions. After that M lines with
 * edge descriptions should follow. Each edge description line should be formed
 * of three numbers - V, U, and W, that represent the source id, destination id
 * and edge weight. Edges and nodes are counted from 0;
 * 
 * @param {String} description Graph description
 * @returns {ResidualGraph} Constructed graph object 
 */
function parseResidualGraphDescription(description) {
    const lines = description.split("\n").filter(notBlank);
    const graph = new ResidualGraph();

    const [n, m] = convertToNumbers(lines[0]);
    if (n <= 0 || m <= 0) {
        throw new Error("description has invalid graph dimensions");
    }

    convertToNumbers(lines[1])
        .map((restriction, idx) => graph.createNode(idx, restriction));

    lines.slice(2).forEach(line => {
        const [v, u, w] = convertToNumbers(line);
        graph.createEdge(v, u, w);
    });

    return graph;
}

/**
 * Partition graph into layers
 * 
 * Performs a BFS on a given graph and remembers when a node was visited for
 * the first time. Nodes are split into layers according to the time they were
 * visited.
 * 
 * @param {ResidualGraph} graph A graph represented by an adjacency list
 * @param {Number} startId An id of starting node
 * @returns {Array<Array<Number>>} List of layers, each containing its node ids
 */
function partitionNodesIntoLayers(graph, startId) {
    const NOT_VISITED = -1;

    if (graph.nodes.length == 0) {
        return [];
    }

    let q = [];
    let visited = [];
    for (let i = 0; i < graph.nodes.length; i++) {
        visited.push(NOT_VISITED);
    }

    visited[startId] = 0;
    const sourceNode = graph.nodes.filter(node => node.id == startId)[0];
    q.push(sourceNode);

    while (q.length > 0) {
        let v = q.pop();

        for (let edge of v.outgoingEdges) {
            let u = edge.destination.id;
            if (visited[u] == NOT_VISITED) {
                q.push(edge.destination);
                visited[u] = visited[v.id] + 1;
            }
        }
    }

    let layersNumber = Math.max(...visited) + 1;
    let layers = [];
    for (let layerId = 0; layerId < layersNumber; layerId++) {
        layers[layerId] = visited
            .map((value, idx) => (value == layerId ? idx : null))
            .filter(value => value != null);
    }
    return layers;
}


/**
 * ResidualGraph represents a directed weighted graph with restriction on nodes
 * 
 * It is aimed to simplify maximum flow calculation process. 
 */
class ResidualGraph {

    constructor() {
        this._edges = [];
        this._nodes = [];
        this._nodeMap = {};
    }

    get nodes() {
        return this._nodes.slice();
    }

    get edges() {
        return this._edges.slice();
    }

    /**
     * Add a new node to the graph
     * 
     * Creates a new node with given id and flow restiction values. Flow
     * value must be non-negative integer number.
     * 
     * @param {Number} nodeId Id of new node
     * @param {Number} flowRestiction Flow restriction value
     */
    createNode(nodeId, flowRestiction) {
        if (this._nodeMap[nodeId]) {
            throw new Error(`graph already has a node with id=${nodeId}`);
        }
        const newNode = new ResidualNode(nodeId, flowRestiction);
        this._nodes.push(newNode);
        this._nodeMap[nodeId] = newNode;
    }

    /**
     * Add a new edge to the graph
     * 
     * Both sides of the edge should exist at the moment of edge creation. Flow
     * value must be non-negative integer number.
     * 
     * @param {Number} sourceId Id of source node
     * @param {Number} destinationId Id of destination node
     * @param {Number} flowRestiction Flow restriction value
     */
    createEdge(sourceId, destinationId, flowRestiction) {
        const sourceNode = this._nodeMap[sourceId];
        const destinationNode = this._nodeMap[destinationId];

        if (!sourceNode || !destinationNode) {
            throw new Error("graph does not contain both sides of the given edge");
        }
        const newEdge = new ResidualEdge(sourceNode, destinationNode, flowRestiction);
        sourceNode.addEdge(newEdge);
        destinationNode.addEdge(newEdge);
        this._edges.push(newEdge);
    }
}


/**
 * ResidualNode is a node of a residual graph
 * 
 * It contains references to adjacent nodes via ResidualEdge instances.
 * Also it stores flow restictions for this node.
 */
class ResidualNode {

    constructor(id, restriction) {
        if (!Number.isInteger(id)) {
            throw new Error("id parameter is not an integer");
        }
        if (!Number.isInteger(restriction) || restriction < 0) {
            throw new Error("restiction parameter has invalid value");
        }

        this._id = id;
        this._restriction = restriction;
        this._flow = 0;
        this._ingoingEdges = [];
        this._outgoingEdges = [];
    }

    get id() {
        return this._id;
    }

    get remainingCapacity() {
        return this._restriction - this._flow;
    }

    get totalCapacity() {
        return this._restriction;
    }

    get flow() {
        return this._flow;
    }

    set flow(value) {
        if (value > this._restriction || value < 0) {
            throw new Error("flow value should not exceed node restrictions");
        }
        this._flow = value;
    }

    get ingoingEdges() {
        return this._ingoingEdges.slice();
    }

    get outgoingEdges() {
        return this._outgoingEdges.slice();
    }

    addEdge(edge) {
        if (!(edge instanceof ResidualEdge)) {
            throw new Error("edge is not a ResidualEdge");
        }

        if (edge.source.id == this._id) {
            this._outgoingEdges.push(edge);
        } else if (edge.destination.id == this._id) {
            this._ingoingEdges.push(edge);
        } else {
            throw new Error("provided edge does not connect with this node");
        }
    }
}


/**
 * ResidualEdge is an edge of a residual graph
 * 
 * It contains references to nodes it connects and its flow restrictions.
 */
class ResidualEdge {

    constructor(source, destination, restriction) {
        if (!(source instanceof ResidualNode)) {
            throw new Error("source parameter is not a ResidualNode");
        }
        if (!(source instanceof ResidualNode)) {
            throw new Error("destination parameter is not a ResidualNode");
        }
        if (!Number.isInteger(restriction) || restriction < 0) {
            throw new Error("restiction parameter has invalid value");
        }

        this._source = source;
        this._destination = destination;
        this._restriction = restriction;
        this._flow = 0;
    }

    get source() {
        return this._source;
    }

    get destination() {
        return this._destination;
    }

    get remainingCapacity() {
        return this._restriction - this._flow;
    }

    get totalCapacity() {
        return this._restriction;
    }

    get flow() {
        return this._flow;
    }

    set flow(value) {
        if (value > this._restriction || value < 0) {
            throw new Error("flow value should not exceed edge restrictions");
        }
        this._flow = value;
    }
}


class MaxflowStepperCalculator {

    constructor(graph, sourceId, sinkId) {
        if (!(graph instanceof ResidualGraph)) {
            throw new Error("graph is not a ResidualGraph");
        }

        this._graph = graph;
        this._sourceId = sourceId;
        this._sinkId = sinkId;
        this._currentMaximumFlow = 0;
        this._finished = false;

        this._sourceNode = this._graph.nodes.filter(node => node.id == this._sourceId)[0];
    }

    get finished() {
        if (this._finished) {
            return true;
        }
        let result = this._constructPathToSink()[this._sinkId];
        return (this._finished = !result);
    }

    get currentMaximumFlow() {
        return this._currentMaximumFlow;
    }

    _constructPathToSink() {
        const NOT_VISITED = -1;

        let q = [];
        let visited = [];
        for (let i = 0; i < this._graph.nodes.length; i++) {
            visited.push(NOT_VISITED);
        }

        visited[this._sourceId] = 0;
        q.push(this._sourceNode);

        let prev = {};
        while (q.length > 0) {
            let v = q.pop();

            if (v.remainingCapacity <= 0) {
                continue;
            }

            for (let edge of v.outgoingEdges) {
                const u = edge.destination.id;
                if (visited[u] == NOT_VISITED && edge.remainingCapacity > 0) {
                    q.push(edge.destination);
                    visited[u] = visited[v.id] + 1;
                    prev[u] = edge;
                }
            }
        }

        return prev;
    }

    calculateNextStep() {
        if (this._finished) {
            return this._formOutput(this._currentMaximumFlow, 0, []);
        }

        let prev = this._constructPathToSink();

        let delta = Number.MAX_VALUE;
        let idx = this._sinkId;
        while (prev[idx]) {
            const edge = prev[idx];
            delta = Math.min(delta, edge.remainingCapacity);
            delta = Math.min(delta, edge.source.remainingCapacity);
            delta = Math.min(delta, edge.destination.remainingCapacity);
            idx = edge.source.id;
        }

        let augmentedPath = [];
        let augmentedNodes = [];
        idx = this._sinkId;
        while (prev[idx]) {
            const edge = prev[idx];
            edge.flow += delta;
            // augmentedNodes.push(edge.source);
            // augmentedNodes.push(edge.destination);
            edge.destination.flow += delta;
            augmentedPath.push(idx);
            idx = edge.source.id;
        }
        this._sourceNode.flow += delta;
        augmentedPath.push(this._sourceId);
        augmentedPath.reverse();

        // [...new Set(augmentedNodes)].forEach(node => {
        //     node.flow += delta;
        // });

        this._currentMaximumFlow += delta;

        return this._formOutput(this._currentMaximumFlow, delta, augmentedPath);
    }

    _formOutput(maximumFlow, bottleneck, augmentedPath) {
        return { maximumFlow, bottleneck, augmentedPath };
    }
}


class MessageBox {
    
    constructor(selector) {
        this._node = document.querySelector(selector);
    }

    setMessage(message) {
        this._node.innerText = message;
    }

    setHtmlMessage(html) {
        this._node.innerHTML = html;
    }

    removeMessage() {
        this.setMessage('');
    }
}


class VisualGraphNode {

    constructor(nodeId, capacity) {
        this._nodeId = nodeId;

        this._flow = 0;
        this._capacity = capacity;
        
        this._initializeNodeElement();
    }

    _initializeNodeElement() {
        this._nodeElement = this._createNodeElement();
        this._updateNodeCapacityMessage();

        this._callbacks = [];
        this._nodeElement.addEventListener('click', () => {
            this._callbacks.forEach(f => f(this));
        });
    }

    _createNodeElement() {
        const id = this._nodeId;
        const nodeHtml = `
        <div class="graph-node" id="graph-node-${id}">
            <div class="node-label">${id + 1}</div>
            <div class="capacity-label"></div>
        </div>
        `;

        const el = document.createElement('template');
        el.innerHTML = nodeHtml.trim();
        return el.content.firstChild;
    }

    _updateNodeCapacityMessage() {
        const message = `${this._flow} / ${this._capacity}`;
        this._nodeElement.lastElementChild.textContent = message;
    }

    get nodeId() {
        return this._nodeId;
    }

    get centerPosition() {
        let x = this._nodeElement.offsetLeft + this._nodeElement.offsetWidth / 2;
        let y = this._nodeElement.offsetTop + this._nodeElement.offsetHeight / 2;
        return [x, y];
    }

    get radius() {
        return this._nodeElement.offsetWidth / 2;
    }

    get el() {
        return this._nodeElement;
    }

    makeSource() {
        this._nodeElement.classList.add('source');
    }

    makeSink() {
        this._nodeElement.classList.add('sink');
    }

    makeInactive() {
        this._nodeElement.classList.add(inactiveClassName);
    }

    makeActive() {
        this._nodeElement.classList.remove(inactiveClassName);
    }

    addFlow(amount) {
        this._flow += amount;
        this._updateNodeCapacityMessage();
    }

    onClick(callback) {
        this._callbacks.push(callback);
    }

    mount(nodeContainerElement) {
        nodeContainerElement.appendChild(this._nodeElement);
    }
}


class VisualGraphEdge {

    constructor(visualNodeA, visualNodeB, capacity) {
        this._visualNodeA = visualNodeA;
        this._visualNodeB = visualNodeB;

        this._flow = 0;
        this._capacity = capacity;

        this._initializeEdgeElement();
        this._initializeCaptionElement();
    }

    _initializeEdgeElement() {
        this._lineElement = this._createLineElement();
        this._updateLineCoordinates();
    }

    _createLineElement() {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('class', 'graph-edge');
        return line;
    }

    _updateLineCoordinates() {
        let [ax, ay] = this._visualNodeA.centerPosition;
        let [bx, by] = this._visualNodeB.centerPosition;
        let [ux, uy] = unitVector(ax, ay, bx, by);
        let r = this._visualNodeA.radius;

        this._lineElement.setAttribute('x1', ax + r*ux);
        this._lineElement.setAttribute('y1', ay + r*uy);
        this._lineElement.setAttribute('x2', bx - (r+1)*ux);
        this._lineElement.setAttribute('y2', by - (r+1)*uy);
    }

    _initializeCaptionElement() {
        this._captionElement = this._createCaptionElement();
        this._updateCaptionMessage();
    }

    _createCaptionElement() {
        const caption = document.createElement('div');
        caption.setAttribute('class', 'graph-edge-caption');
        return caption;
    }

    _updateCaptionMessage() {
        const message = `${this._flow} / ${this._capacity}`;
        this._captionElement.innerText = message;
    }

    makeInactive() {
        this._lineElement.classList.add(inactiveClassName);
        this._captionElement.classList.add(inactiveClassName);
    }

    makeActive() {
        this._lineElement.classList.remove(inactiveClassName);
        this._captionElement.classList.remove(inactiveClassName);
    }

    addFlow(amount) {
        this._flow += amount;
        this._updateCaptionMessage();
    }

    mount(svgContainerElement, captionContainerElement) {
        svgContainerElement.appendChild(this._lineElement);

        this._captionAnchorElement = captionContainerElement;
        captionContainerElement.appendChild(this._captionElement);
        this._updateCaptionCoordinates();
    }

    _updateCaptionCoordinates() {
        let [ax, ay] = this._visualNodeA.centerPosition;
        let [bx, by] = this._visualNodeB.centerPosition;
        let [_, uy] = unitVector(ax, ay, bx, by);
        let r = this._visualNodeA.radius;

        let lineCenterX = (ax+bx)/2;
        let lineCenterY = (ay+by)/2 - r;
        let linePointsUp = uy < 0;

        const anchorElement = this._captionAnchorElement;
        let y = anchorElement.offsetHeight - lineCenterY - 24;
        this._captionElement.style['bottom'] = `${y}px`;

        let x = lineCenterX;
        if (linePointsUp) {
            x = anchorElement.offsetWidth - x;
            this._captionElement.style['right'] = `${x}px`;
        } else {
            this._captionElement.style['left'] = `${x}px`;
        }
    }

    redraw() {
        this._updateLineCoordinates();
        this._updateCaptionCoordinates();
    }
}


const MaxflowSagaStates = {
    INITIAL: 1,
    SOURCE_SELECTED: 2,
    SINK_SELECTED: 3,
    IN_PROGRESS: 4,
    FINISHED: 5
};


class MaxflowController {
    
    constructor(graph) {
        this._graph = graph;
        
        this._guidanceMessageBox = new MessageBox('.message.top-right-message');
        this._dataMessageBox = new MessageBox('.message.bottom-left-message');

        this._nodeLayerContainer = document.querySelector('.graph-canvas .graph-nodes');
        this._edgeContainer = document.querySelector('.graph-edges');
        this._edgeCaptionContainer = document.querySelector('.graph-canvas');

        this._nodes = [];
        this._edges = [];

        this._displayGraph();

        this._nodes.forEach(n => n.onClick((id) => this._handleNodeClick(id)));

        const canvasElement = document.querySelector('.graph-canvas');
        canvasElement.onclick = () => this._handleGraphCanvasClick();
        document.onkeydown = () => this._handleGraphCanvasClick();

        this._state = MaxflowSagaStates.INITIAL;
        this._updateMessages();
        this._maxflowCalculator = null;
    }

    _displayGraph() {
        const graph = this._graph;
        const nodeByLayerDistribution = partitionNodesIntoLayers(graph, 0);

    
        this._nodeMap = {};
        this._edgeMap = {};
    
        for (let layerIdx = 0; layerIdx < nodeByLayerDistribution.length; layerIdx++) {
            const layerElement = this._createNodeLayer(layerIdx);
            this._nodeLayerContainer.appendChild(layerElement);
    
            for (let nodeIdx of nodeByLayerDistribution[layerIdx]) {
                const node = graph.nodes.filter(x => x.id === nodeIdx)[0];
                const visualNode = new VisualGraphNode(nodeIdx, node.totalCapacity);
                visualNode.mount(layerElement);
                this._nodes.push(visualNode);
                this._nodeMap[nodeIdx] = visualNode;
            }
        }
    
        for (let edge of graph.edges) {
            const sourceElement = this._nodeMap[edge.source.id];
            const destinationElement = this._nodeMap[edge.destination.id];
    
            const visualEdge = new VisualGraphEdge(sourceElement, destinationElement, edge.totalCapacity);
            visualEdge.mount(this._edgeContainer, this._edgeCaptionContainer);
            this._edges.push(visualEdge);
            
            if (!this._edgeMap[edge.source.id]) {
                this._edgeMap[edge.source.id] = {};
            }
            this._edgeMap[edge.source.id][edge.destination.id] = visualEdge;
        }
    }

    _createNodeLayer(layerId) {
        const layer = document.createElement('div');
        layer.id = `graph-layer-${layerId}`;
        layer.classList.add('graph-layer');
        return layer;
    }

    _updateMessages() {
        switch (this._state) {
            case MaxflowSagaStates.INITIAL:
                this._guidanceMessageBox.setHtmlMessage(`
                    Tap on a node to mark it as a <b>source</b> <br/> node of transport network
                `);
                this._dataMessageBox.removeMessage();
                break;

            case MaxflowSagaStates.SOURCE_SELECTED:
                this._guidanceMessageBox.setHtmlMessage(`
                    Tap on a node to mark it as a <b>sink</b> <br/> node of transport network
                `);
                this._dataMessageBox.removeMessage();
                break;

            case MaxflowSagaStates.SINK_SELECTED:
                this._guidanceMessageBox.setHtmlMessage(`
                    To continue to the next step press <b>any key</b> <br/> or tap at <b>any point</b> on the screen 
                `);
                this._dataMessageBox.setHtmlMessage(`
                    Current maxflow value: <b>0</b>
                `);
                break;
            
            case MaxflowSagaStates.IN_PROGRESS:
                this._guidanceMessageBox.setHtmlMessage(`
                    To continue to the next step press <b>any key</b> <br/> or tap at <b>any point</b> on the screen 
                `);
                this._dataMessageBox.setHtmlMessage(`
                    Path augmented: <br/> <b>${this._augmentedPath.map(x => x + 1).join(' - ')}</b><br><br>
                    Bottleneck capacity: <br> <b>${this._bottleneckCapacity}</b> <br><br><br>
                    Current maxflow value: <b>${this._maxflow}</b>
                `);
                break;

            case MaxflowSagaStates.FINISHED:
                this._guidanceMessageBox.setHtmlMessage(`
                    Maxflow calculation is finished <br><br>
                    To calculate maxflow for another graph <br>
                    use <b>File -> Import</b> option
                `);
                this._dataMessageBox.setHtmlMessage(`Current maxflow value: <b>${this._maxflow}</b>`);
                break;
        }
    }

    _handleNodeClick(node) {
        switch (this._state) {
            case MaxflowSagaStates.INITIAL:
                this._sourceId = node.nodeId;
                node.makeSource();
                this._state = MaxflowSagaStates.SOURCE_SELECTED;
                break;

            case MaxflowSagaStates.SOURCE_SELECTED:
                if (node.id === this._sourceId) {
                    return;
                }
                this._sinkId = node.nodeId;
                node.makeSink();
                this._maxflowCalculator = new MaxflowStepperCalculator(this._graph, this._sourceId, this._sinkId);
                this._maxflow = 0;

                // TODO add function changeState
                this._state = MaxflowSagaStates.SINK_SELECTED;
                this._nodes.forEach(node => {
                    node.makeInactive();
                });
                this._edges.forEach(edge => {
                    edge.makeInactive();
                });
                break;
        }
        this._updateMessages();
    }

    _handleGraphCanvasClick() {
        switch (this._state) {
            case MaxflowSagaStates.SINK_SELECTED:
                this._state = MaxflowSagaStates.IN_PROGRESS;
                break;

            case MaxflowSagaStates.IN_PROGRESS:
                if (this._maxflowCalculator.finished) {
                    this._state = MaxflowSagaStates.FINISHED;
                    this._nodes.forEach(node => {
                        node.makeActive();
                    });
                    this._edges.forEach(edge => {
                        edge.makeActive();
                    });
                } else {
                    this._nodes.forEach(node => {
                        node.makeInactive();
                    });
                    this._edges.forEach(edge => {
                        edge.makeInactive();
                    });

                    let { maximumFlow, bottleneck, augmentedPath } = this._maxflowCalculator.calculateNextStep();
                    this._augmentedPath = augmentedPath;

                    for (let nodeId of augmentedPath) {
                        const node = this._nodeMap[nodeId];
                        node.makeActive();
                        node.addFlow(bottleneck);
                    }
                    for (let i = 0; i < augmentedPath.length-1; i++) {
                        const edge = this._edgeMap[augmentedPath[i]][augmentedPath[i+1]];
                        edge.makeActive();
                        edge.addFlow(bottleneck);
                    }

                    this._maxflow = maximumFlow;
                    this._bottleneckCapacity = bottleneck;
                }
                this._updateMessages();
                break;
        }
    }

    redrawGraph() {
        this._edges.forEach(e => e.redraw());
    }

    destroy() {
        this._dataMessageBox.removeMessage();
        this._guidanceMessageBox.removeMessage();

        [...this._nodeLayerContainer.children].forEach(el => {
            el.remove();
        });

        [...this._edgeContainer.children].filter(el => el.nodeName === 'line').forEach(el => el.remove());
        [...this._edgeCaptionContainer.children]
            .filter(el => el.classList.contains('graph-edge-caption'))
            .forEach(el => el.remove());
    }
}


class ApplicationController {
    
    constructor() {
        /* register handlers for top bar buttons */
        this._registerAboutButtonEvents();
        this._registerImportFromFileButtonEvents();
        this._registerLoadSampleButtonEvents();

        /* register handlers for browser events */
        this._registerWindowResizeEvents();
        
        this._maxflowController = null;
    }

    _registerAboutButtonEvents() {
        const aboutButton = document.getElementById('about');

        aboutButton.addEventListener('click', () => {
            console.log('about clicked');
        });
    }

    _registerImportFromFileButtonEvents() {
        const importGraphButton = document
            .querySelector('#graph-file-loader input[type="file"]');
        
        importGraphButton.addEventListener('input', (e) => {
            let fileReader = new FileReader();
            fileReader.onload = (event) => {
                const data = event.target.result;
                this._startMaxflowCalculationWorkflow(data);
            }
            fileReader.onerror = (event) => {
                console.error('could not read file');
            }

            let file = e.target.files[0];
            fileReader.readAsText(file);
        });
    }

    _startMaxflowCalculationWorkflow(graphString) {
        const welcomePane = document.getElementById('welcome-screen');
        welcomePane.classList.add('hidden');

        const graphViewerPane = document.getElementById('graph-viewer');
        graphViewerPane.classList.remove('hidden');

        try {
            const graph = parseResidualGraphDescription(graphString);

            if (this._maxflowController) {
                this._maxflowController.destroy();
            }

            this._maxflowController = new MaxflowController(graph);
        } catch (err) {
            this._maxflowController = null;
            welcomePane.classList.remove('hidden');
            graphViewerPane.classList.add('hidden');
            console.error(err);
        }
    }

    _registerLoadSampleButtonEvents() {
        const loadSampleButton = document.getElementById('graph-sample-loader');
        loadSampleButton.addEventListener('click', () => {
            this._startMaxflowCalculationWorkflow(sampleGraph0);
        });
    }

    _registerWindowResizeEvents() {
        window.addEventListener('resize', () => {
            if (this._maxflowController) {
                this._maxflowController.redrawGraph();
            }
        });
    }
}


const applicationController = new ApplicationController();