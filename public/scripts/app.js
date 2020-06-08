const svg = document.querySelector('.graph-edges');
const edge_caption_parent = document.querySelector('.graph-canvas');

// TODO add graph-canvas redrawing on window resize
// TODO split source code into modules

function create_edge_between(el1, el2, caption) {
    let x1 = el1.offsetLeft + el1.offsetWidth / 2;
    let y1 = el1.offsetTop + el1.offsetHeight / 2;

    let x2 = el2.offsetLeft + el2.offsetWidth / 2;
    let y2 = el2.offsetTop + el2.offsetHeight / 2;

    let a = x2 - x1;
    let b = y2 - y1;

    let v = Math.sqrt(a*a + b*b);

    let ua = a / v;
    let ub = b / v;

    let r = 48 / 2;

    newCaption = `${el1.dataset.id}-${el2.dataset.id}`; 

    const newLine = document.createElementNS('http://www.w3.org/2000/svg','line');
    newLine.setAttribute('id', `graph-edge-${el1.dataset.id}-${el2.dataset.id}`);
    newLine.setAttribute('class', 'graph-edge')
    newLine.setAttribute('x1', x1 + r * ua);
    newLine.setAttribute('y1', y1 + r * ub);
    newLine.setAttribute('x2', x2 - (r+1) * ua);
    newLine.setAttribute('y2', y2 - (r+1) * ub);

    svg.appendChild(newLine);

    let centerX = x1 + ua*(v/2);
    let centerY = y1 + ub*(v/2) - 24;

    const captionElement = document.createElement('div');
    captionElement.setAttribute('class', 'graph-edge-caption')

    if (ub < 0) {
        const canvasElement = el1.parentElement.parentElement.parentElement;
        centerX = canvasElement.offsetWidth - centerX;
        centerY = canvasElement.offsetHeight - centerY - 24;

        captionElement.style['right'] = `${centerX}px`;
        captionElement.style['bottom'] = `${centerY}px`;
    } else {
        const canvasElement = el1.parentElement.parentElement.parentElement;
        centerY = canvasElement.offsetHeight - centerY - 24;

        captionElement.style['left'] = `${centerX}px`;
        captionElement.style['bottom'] = `${centerY}px`;
    }

    captionElement.innerText = String(newCaption);
    edge_caption_parent.appendChild(captionElement);
}

const node_labels = ['1', '2', '3', '4', '5', '6', '7', '8'];
const node_adj_list = [
    /* 1 */ [1, 2],
    /* 2 */ [3, 5],
    /* 3 */ [4, 5, 6],
    /* 4 */ [7],
    /* 5 */ [7],
    /* 6 */ [7],
    /* 7 */ [7],
    /* 8 */ []
];

const layers = [
    [0],
    [1, 2],
    [3, 4, 5, 6],
    [7]
];

function create_node(idx, layerIdx) {
    const layer = document.getElementById(`graph-layer-${layerIdx}`);
    
    const nodeHtml = `
    <div class="graph-node" data-id="${idx}" id="graph-node-${idx}">
        <div class="label">${node_labels[idx]}</div>
    </div>
    `;

    const t = document.createElement('template');
    t.innerHTML = nodeHtml.trim();
    const node = t.content.firstChild;

    layer.appendChild(node);

    return node;
}

const nodeElements = [];
for (let i = 0; i < layers.length; i++) {
    for (let nodeIdx of layers[i]) {
        nodeElements.push(create_node(nodeIdx, i));
    }
}

for (let i = 0; i < node_labels.length; i++) {
    for (let destinationIdx of node_adj_list[i]) {
        create_edge_between(nodeElements[i], nodeElements[destinationIdx], '123');
    }
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

/* register handlers for toolbar actions */
[...document.querySelectorAll('.graph-file-loader')].forEach(item => {
    item.addEventListener('click', () => {
        confirm('Do you want to load a graph?');
    });
});

[...document.querySelectorAll('.graph-sample-loader')].forEach(item => {
    item.addEventListener('click', () => {
        alert('Loading a sample graph..');
    });
});

[...document.querySelectorAll('.about')].forEach(item => {
    item.addEventListener('click', () => {
        alert('Maxflow calculator');
    });
});