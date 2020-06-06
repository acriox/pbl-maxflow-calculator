const svg = document.querySelector('.graph-edges');

function drawLineBetweenNodes(el1, el2) {
	let x1 = el1.offsetLeft + el1.offsetWidth / 2;
	let y1 = el1.offsetTop + el1.offsetHeight / 2;

	let x2 = el2.offsetLeft + el2.offsetWidth / 2;
	let y2 = el2.offsetTop + el2.offsetHeight / 2;

	let a = x2 - x1;
	let b = y2 - y1;

	let v = Math.sqrt(a*a + b*b);

	a /= v;
	b /= v;

	let r = 48 / 2;

	x1 += r * a;
	y1 += r * b;

	x2 -= (r+1) * a;
	y2 -= (r+1) * b;

	const newLine = document.createElementNS('http://www.w3.org/2000/svg','line');
	newLine.setAttribute('id', `graph-edge-${el1.dataset.id}-${el2.dataset.id}`);
	newLine.setAttribute('class', 'graph-edge')
	newLine.setAttribute('x1', x1);
	newLine.setAttribute('y1', y1);
	newLine.setAttribute('x2', x2);
	newLine.setAttribute('y2', y2);
	svg.appendChild(newLine);
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
]

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
		drawLineBetweenNodes(nodeElements[i], nodeElements[destinationIdx]);
	}
}