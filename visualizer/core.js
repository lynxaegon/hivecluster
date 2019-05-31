window.Visualizer = {};
let { init, Sprite, GameLoop } = kontra;

let { canvas } = init();
Visualizer.isDirty = false;
Visualizer.nodeList = {};

let loop = GameLoop({
	update: function() {
		for(let i in Visualizer.nodeList){
			for(let j in Visualizer.nodeList[i].links){
				Visualizer.nodeList[i].links[j].update();
			}
		}

		for(let i in Visualizer.nodeList){
			Visualizer.nodeList[i].update();
		}
	},
	render: function() {
		arrangeNodes();

		for(let i in Visualizer.nodeList){
			for(let j in Visualizer.nodeList[i].links){
				Visualizer.nodeList[i].links[j].render();
			}
		}

		for(let i in Visualizer.nodeList){
			Visualizer.nodeList[i].render();
		}
	}
});
loop.start();

function addNode(id){
	Visualizer.nodeList[id] = Sprite({
		x: 0,
		y: 0,
		id: id,
		color: 'blue',
		radius: 20,
		links: [],
		render: function() {
			this.context.fillStyle = this.color;
			this.context.beginPath();
			this.context.arc(this.x + this.radius, this.y + this.radius, this.radius, 0, 2  * Math.PI);
			this.context.fill();
		}
	});
	Visualizer.isDirty = true;
}

function addLink(source, target){
	source = Visualizer.nodeList[source];
	target = Visualizer.nodeList[target];

	source.links.push(getLink(source, target));

	target.links.push(getLink(target, source));
}

function getLink(source, target){
	return Sprite({
		source: target,
		target: source,
		color: 'red',
		render: function() {
			this.context.fillStyle = this.color;
			this.context.beginPath();
			this.context.moveTo(this.source.x + this.source.radius, this.source.y + this.source.radius);
			this.context.lineTo(this.target.x + this.target.radius, this.target.y + this.source.radius);
			this.context.stroke();
		}
	});
}

function arrangeNodes(){
	if(Visualizer.isDirty){
		let radius = (CANVAS_WIDTH / 3);
		let angle;
		let totalNodes = Object.keys(Visualizer.nodeList).length;
		let index = 0;
		for (let id in Visualizer.nodeList) {
			if(!Visualizer.nodeList.hasOwnProperty(id))
				continue;

			angle = (index / (totalNodes / 2)) * Math.PI;
			Visualizer.nodeList[id].x = (radius * Math.cos(angle)) + (CANVAS_WIDTH / 2);
			Visualizer.nodeList[id].y = (radius * Math.sin(angle)) + (CANVAS_HEIGHT / 2);
			index++;
		}

		Visualizer.isDirty = false;
	}
}