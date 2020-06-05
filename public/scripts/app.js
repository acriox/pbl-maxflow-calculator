class MessageBox {
	constructor(selector) {
		this._element = document.querySelector(selector);
	}

	set text(value) {
		this._element.innerHTML = String(value);
	}

	get text() {
		return this._element.innerHTML;
	}
}

const topRightMessageBox = new MessageBox('.top-right-message');
const bottomLeftMessageBox = new MessageBox('.bottom-left-message');

topRightMessageBox.text = "I should be on the top right side";
bottomLeftMessageBox.text = "I should be on the bottom left side";
