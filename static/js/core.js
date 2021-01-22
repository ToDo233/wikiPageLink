const ERROR = document.querySelector('.inner');
const LOADING = document.querySelector('.loader');
const BOX = document.querySelector('.box');
// 默认线长，对应canvans对象的属性是obj.width
const LINE_LENGTH = 105;
const ROUND_ANGLE = 360;
const CIRCLE_COLOR = '#e5e7eb';

var base_url =
	'https://en.wikipedia.org/';
var api_url =
	'w/api.php?format=json&origin=*&action=parse&prop=text&section=0&redirects=1&page=';
const corss_api_url =
	'https://cors-anywhere.sssc.workers.dev/?';
var suggest_url =
	'w/api.php?action=opensearch&format=json&formatversion=2&namespace=0&limit=4&search=';

var canvas = null;
// 判断动作是移动还是点击
var isMoved = false;
// 深度，也许后续会用上
var deep = 0;
// 存储遍历的root节点
var pathTree = [];
// 初始节点坐标
var rootStart = {
	x: 250,
	y: 175
};
// 保存节点关键字
var nodeKey = [];
var isPanning = false;
// 用于切换wiki中英文站点的标识，默认值为'en' 
var env = 'en';
var redirectCount = 0;
// Init fabric_canvas
(function() {
	canvas = this.__canvas = new fabric.Canvas('c', {
		selection: false,
		targetFindTolerance: 2,
	});
	fabric.Object.prototype.originX = fabric.Object.prototype.originY = 'center';
	canvas.backgroundColor = '#002b36';
	rootStart = {
		x: getCenterCoord().x,
		y: getCenterCoord().y
	};
})();

window.canvas = canvas;
window.zoom = window.zoom ? window.zoom : 1;

/**
 * 获取canvas 中心点的坐标
 *
 * @returns {object} center point
 */
function getCenterCoord() {
	return {
		x: fabric.util.invertTransform(canvas.viewportTransform)[4] + (canvas.width / canvas.getZoom()) / 2,
		y: fabric.util.invertTransform(canvas.viewportTransform)[5] + (canvas.height / canvas.getZoom()) / 2
	}
}

/**
 * 绘制节点
 *
 * @param {number} left left 
 * @param {number} top top
 * @param {object} line 当前节点到所属root节点连线的对象,初始root节点line值为null
 * @param {object} root 当前节点的root节点对象,初始root节点root值为null
 * @param {object} keyWord 关键字
 * @param {boolean} isRoot 是否为root节点
 * @returns {object} 绘制节点对象
 */

function makeCircle(left, top, line, root, keyWord, isRoot) {
	var c = new fabric.Circle({
		left: left,
		top: top,
		strokeWidth: 2,
		radius: isRoot ? 22 : 12,
		fill: CIRCLE_COLOR,
		stroke: '#666'
	});
	c.hasControls = c.hasBorders = false;
	c.line = line;
	c.root = root;
	c.isRoot = isRoot;
	c.keyWord = keyWord;
	return c;
}

/**
 * 绘制连线
 *
 * @param {{x:x,y:y}} coords 起点和终点的坐标
 * @returns {object} 绘制连线对象
 */
function makeLine(coords) {
	// var line = new fabric.Line(coords, {
	//      fill: '#666',
	//      stroke: '#666',
	//      strokeWidth: 1.1,
	//      selectable: false,
	//      evented: false,
	//   type: 'line,
	//    });
	var line = new fabric.Path('M 65 0 Q 100, 100, 200, 0', {
		fill: '',
		stroke: '#666',
		strokeWidth: 1.1,
		objectCaching: false,
		type: 'line',
		evented: false,
		selectable: false,
	});
	line.path[0][1] = coords[0];
	line.path[0][2] = coords[1];
	line.path[1][1] = coords[2];
	line.path[1][2] = coords[3];
	line.path[1][3] = coords[2];
	line.path[1][4] = coords[3];
	return line;
}

/**
 * 绘制文本
 *
 * @param {string} str 需要绘制的文本
 * @param {number} left 文本的坐标
 * @param {number} top 文本的坐标
 * @param {number} fontSize 文本大小
 * @returns {object} 文本对象
 */
function makeText(str, left, top, fontSize) {
	return new fabric.Text(str, {
		left: left,
		top: top,
		fill: '#fff',
		strokeWidth: 1,
		objectCaching: false,
		fontSize: fontSize,
	});
}

//监听鼠标按下动作,还原isMoved 为 false
canvas.on('mouse:down', function(e) {
	//var p = e.target;
	isMoved = false;
	//按住alt键拖动画布
	// if(event.altKey) {
	//   isPanning = true;
	// }
});

/**
 * 监听鼠标抬起动作,
 * 因为移动canvas的对象会触发mouse_down事件,
 * 所以当mouse_up且isMoved为false时判断为点击节点,
 * 子节点被点击生成下一级节点，且当前节点变为root节点
 */
canvas.on('mouse:up', function(e) {
	isPanning = false;
	if (e.target && e.target.type != 'line') {
		console.log(e.target)
		var p = e.target._objects[0];
		if (p && p.keyWord && !p.isRoot && !isMoved) {
			p.isRoot = true;
			//p.set('radius', 20);
			//e.target._objects[1].set('top', e.target._objects[1].top + 10);
			getwikipediaContent(p.keyWord, {
				x: e.target.left + p.left,
				y: e.target.top + p.top
			}, p);
		}
	}
});

//移动画布
canvas.on('mouse:move', function(e) {
	if (isPanning && event) {
		console.log(canvas.getObjects().filter(item => item.type === 'line'))
		var delta = new fabric.Point(event.movementX, event.movementY);
		canvas.relativePan(delta);
	}
});

// 移动结束事件,设置 isMoved = true 标记为移动过
canvas.on('object:moved', function(e) {
	//移动:点击
	isMoved = true;
});

/**
 * 鼠标移入事件,当鼠标移动到节点上时高亮当前节点到
 * 初始节点的路径,并将节点加入 pathTree 
 */
canvas.on('mouse:over', function(e) {
	var p = e.target;
	if (p && p.type != 'line' && p._objects) {
		var root = p._objects[0];
		getDes(root.keyWord);
		BOX.style.display = 'inline-block';
		BOX.innerHTML = 'Loading ...';
		BOX.style.left = event.clientX + 50 + 'px';
		BOX.style.top = event.clientY - 150 + 'px';
		BOX.style.width = '300px'
		BOX.style.zIndex = 99;
		while (root) {
			if (root.line) {
				root.line.set('stroke', '#fff');
				root.line.set('strokeWidth', 5);
				pathTree.push(root.line);
			}
			root.set('fill', '#fff');
			pathTree.push(root);
			root = root.root;
		}
		canvas.renderAll();
	}
});

/**
 * 鼠标移出事件,当鼠标移出节点时根据 pathTree 的元素取消
 * 高亮当前节点到初始节点的路径。  
 */
canvas.on('mouse:out', function(e) {
	BOX.style.zIndex = 0;
	pathTree.forEach(function(ele) {
		if (ele.type === 'line') {
			ele.set('stroke', '#666');
			ele.set('strokeWidth', 1);
		} else {
			ele.set('fill', CIRCLE_COLOR);
		}
	});
	pathTree = [];
	canvas.renderAll();
});

/**
 * canvas对象移动事件
 */
canvas.on('object:moving', function(e) {
	var p = e.target._objects[0];
	if (p.line) {
		p.line.path[1][3] = e.target.left + p.left;
		p.line.path[1][4] = e.target.top + p.top;
	}
	if (p.isRoot) {
		//获取所有root节点关键字一致的节点
		var pf = canvas.getObjects().filter(item => item._objects && item._objects[0].root && item._objects[0].root.keyWord ===
			p.keyWord);
		pf.forEach(function(ele, i) {
			if (ele._objects[0].line) {
				var line = ele._objects[0].line;
				line.path[0][1] = e.target.left + p.left;
				line.path[0][2] = e.target.top + p.top;
			}
		});
	}
	canvas.renderAll();
});

canvas.on("mouse:wheel", function(e) {
	var zoom = (event.deltaY > 0 ? -0.1 : 0.1) + canvas.getZoom();
	setZoom(event, zoom);
});


// function checkIntersects(){
// 	var o = canvas.getObjects().filter(item => item.type === 'node' );
// 	for(var i = 0;i<o.length;i++){
// 		var o1 = o[i];
// 		var j = Math.min(i+1,o.length-1);
// 		var o2 = o[j];
// 		if(o1.intersectsWithObject(o2)){
// 			console.log(o1)
// 			o1.top = o2.top+25;
// 			o1._objects[0].line.path[1][4] = o1._objects[0].line.path[1][2] = o1.top+o1._objects[0].top;
// 			console.log(o1)
// 		}
// 	}
// }

function setZoom(event, zoom) {
	zoom = Math.max(0.3, zoom);
	zoom = Math.min(1.1, zoom);
	var point = new fabric.Point(canvas.width / 2, canvas.height / 2);
	canvas.zoomToPoint(point, zoom);
}


/**
 * 获取节点简介，当鼠标移动到节点上时触发
 * 显示当前节点关键字的简介信息
 * @param {Object} keyWord
 */
function getDes(keyWord) {
	Ajax.get(base_url + 'api/rest_v1/page/summary/' + keyWord,
		null,
		function(res) {
			var htmlObj = JSON.parse(res);
			BOX.innerHTML = htmlObj.extract_html;
		}
	);
}

/**
 * 获取子节点坐标,以标准线宽为半径做圆并且平分圆弧，返回圆弧
 * 的平分点坐标为子节点坐标
 * @param {Object} pos
 * @param {number} count
 * @returns {{x:x,y:y}}} 子节点坐标
 */
function getBisectingPoints(pos, count) {
	var points = [];
	//计算平分角
	var angle = Math.round(ROUND_ANGLE / (count));
	var radians = (Math.PI / 180) * angle;
	//如果子节点数量大于15则延长线宽为原1.5倍
	//var r = count < 8 ? LINE_LENGTH : LINE_LENGTH * 1.5;
	for (var i = 0; i < count; i++) {
		var r = LINE_LENGTH;
		if (count < 6) {
			r = LINE_LENGTH * 0.5;
		}
		if (count > 8 && i % 2 === 0) {
			r = LINE_LENGTH * 1.5;
		}

		var x = pos.x + r * Math.sin(radians * i);
		var y = pos.y + r * Math.cos(radians * i);
		points.unshift({
			x: x,
			y: y
		});
	}
	console.log(points);
	return points;
}

/**
 * 检查和切换站点，
 * 如果用户输入了中文则会切换为 'zh'并访问wiki中文站点
 * @param {Object} keyWord 
 */
function envCheck(keyWord) {
	console.log(keyWord)
	const regex = new RegExp('[\\u4E00-\\u9FFF]+', 'g');
	if (regex.test(keyWord)) {
		if (env === 'en') {
			env = 'zh';
			base_url = base_url.replace('en', 'zh');
		}
	} else {
		env = 'en';
		base_url = base_url.replace('zh', 'en');
	}
	console.log(env)
}

function ErrorTip(errorInfo){
	ERROR.style.zIndex = 99;
	ERROR.innerHTML = 'ERROR:' + errorInfo;
	setTimeout(function(){	
		ERROR.style.zIndex = 0;
	},2000);
}

/**
 * 获取wiki资料
 * @param {Object} keyWord 关键字
 * @param {Object} start 当前root节点坐标
 * @param {Object} root root节点的root节点 --！
 */
function getwikipediaContent(keyWord, start, root) {
	envCheck(keyWord);
	var url = base_url + api_url + keyWord.toLowerCase();
	var start = start ? start : rootStart;
	var root = root ? root : null;
	// 如果root为null则是查询了新的关键词，清空上一次查询的数据
	if (!root) {
		canvas._objects = [];
		nodeKey = [];
		canvas.renderAll();
	}
	LOADING.style.zIndex = 99;
	Ajax.get(url, LOADING, function(res) {
		var contentObj = JSON.parse(res);
		// wiki返回了错误信息，显示信息
		// 可能是页面不存在
		if (contentObj.error) {
			ErrorTip(contentObj.error.info);
			// ERROR.style.zIndex = 99;
			// ERROR.innerHTML = 'ERROR:' + contentObj.error.info;
			// setTimeout(function(){	
			// 	ERROR.style.zIndex = 0;
			// },2000);
			return;
		}

		// wiki针对关键词返回了可能的转发信息'redirects'，
		// 将redirects 里的to作为新的关键词重新请求 
		// 修复了无限 redirects导致的死循环 --！
		if (contentObj.parse.redirects.length > 0) {
			var to = contentObj.parse.redirects[0].to;
			if (to != contentObj.parse.redirects[0].from && redirectCount < 2) {
				redirectCount++;
				console.log('the page redirect to ' + to);
				getwikipediaContent(to, start, root);
				return;
			}
		}
		redirectCount = 0;
		// wiki返回了查询结果的dom，可以使用正则表达式提取或者加载dom
		// 然后通过js dom解析结果，这里选择的是dom操作，创建一个div然后
		// 将返回的dom  innerHtml 
		var objE = document.createElement('div');
		objE.className = 'temp';
		// 去除转义符
		objE.innerHTML = JSON.stringify(contentObj.parse.text).replace(/\\"/g, '');
		var domList = objE.childNodes[1].querySelectorAll('p');
		var keyList = [];
		var k = [];
		outer:
			for (var domCount = 0; domCount < domList.length; domCount++) {
				var domEle = domList[domCount];
				var c = domEle.childNodes;
				for (var i = 0; i < c.length; i++) {
					var childNode = c[i];
					if (childNode.nodeName === 'B') {
						keyList = domEle.querySelectorAll('a');
						keyList.forEach(function(keyEle) {
							var hrefVal = keyEle.attributes[0].nodeValue;
							//中文结果需要转码
							if (env === 'zh') {
								hrefVal = decodeURIComponent(hrefVal);
							}
							if (hrefVal.indexOf('wiki/') > -1 && hrefVal.indexOf(':') < 0) {
								var dhrefVal = hrefVal.split('/');
								//去重
								if (k.indexOf(dhrefVal[2]) < 0) {
									var ck = dhrefVal[2];
									if (env === 'en') {
										ck = dhrefVal[2].toUpperCase();
									}
									if (nodeKey.indexOf(ck) < 0) {
										k.push(dhrefVal[2])
									}
								}
							}
						});
						break outer;
					}
				}
			}
		test(start, keyWord, k, root);
	})
}


/**
 * 
 * 将绘制好的节点加入canvas
 * @param {Object} rootStart
 * @param {Object} keyWord
 * @param {Object} k
 * @param {Object} root
 */
function test(rootStart, keyWord, k, root) {

	var count = k.length;
	//最多添加10个节点
	count = Math.min(10, count);
	var points = getBisectingPoints(rootStart, count);
	//添加root节点
	if (root === null) {
		if (env === 'en') {
			nodeKey.push(keyWord.toUpperCase());
		} else {
			nodeKey.push(keyWord);
		}
		root = makeCircle(rootStart.x, rootStart.y, null, null, keyWord, true);
		var itext = makeText(keyWord, rootStart.x, rootStart.y + 35, 17);
		var group = new fabric.Group([root, itext], {});
		group.hasControls = group.hasBorders = false;
		group.type = 'node';
		canvas.add(
			group
		);
	}
	//添加子节点
	for (var i = 0; i < count; i++) {
		var key = k[i].replace(/_/g, ' ');
		var ck = key;
		if (env === 'en') {
			ck = key.toUpperCase();
		}
		//if (nodeKey.indexOf(ck) < 0) {
		nodeKey.push(ck);
		var line = makeLine([rootStart.x, rootStart.y, points[i].x, points[i].y]);
		var de = points[i].y > root.top + root.group.top ? 25 : -25;
		var itext = makeText(key, points[i].x, points[i].y + de, 13);
		var group = new fabric.Group([makeCircle(points[i].x, points[i].y, line, root, key, false), itext], {});
		group.hasControls = group.hasBorders = false;
		group.type = 'node';
		canvas.add(
			line,
			group
		);
		canvas.sendToBack(line);
		//	}
	}
	deep++;
	//checkIntersects();
}
