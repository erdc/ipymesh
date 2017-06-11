var widgets = require('jupyter-js-widgets');
var _ = require('underscore');
var d3 = require('d3');

// Custom Model. Custom widgets models must at least provide default values
// for model attributes, including
//
//  - `_view_name`
//  - `_view_module`
//  - `_view_module_version`
//
//  - `_model_name`
//  - `_model_module`
//  - `_model_module_version`
//
//  when different from the base class.

// When serialiazing the entire widget state for embedding, only values that
// differ from the defaults will be specified.
var PSLGEditorModel = widgets.DOMWidgetModel.extend({
    defaults: _.extend(_.result(this, 'widgets.DOMWidgetModel.prototype.defaults'), {
        _model_name: 'PSLGEditorModel',
        _view_name: 'PSLGEditorView',
        _model_module : 'ipymesh-widgets',
        _view_module : 'ipymesh-widgets',
        _model_module_version : '0.1.0',
        _view_module_version : '0.1.0',
        width: 600,
        height: 600,
        Lx: 1.0,
        Ly: 1.0,
        x0: 0.0,
        y0: 0.0,
        vertices: [],
        vertexFlags: [],
        segments: [],
        segmentFlags: [],
        regions: [],
        regionFlags: [],
        holes: [],
        boundaryTypes: [],
        regionTypes: [],
    })
}, {
    serializers: _.extend({
        vertices: { deserialize: widgets.unpack_models },
        vertexFlags: { deserialize: widgets.unpack_models },
        segments: { deserialize: widgets.unpack_models },
        segmentFlags: { deserialize: widgets.unpack_models },
        regions: { deserialize: widgets.unpack_models },
        regionFlags: { deserialize: widgets.unpack_models },
        holes: { deserialize: widgets.unpack_models },
        boundaryTypes: { deserialize: widgets.unpack_models },
        regionTypes: { deserialize: widgets.unpack_models },
    }, widgets.DOMWidgetModel.serializers)
});


var PSLGEditorView = widgets.DOMWidgetView.extend({
    render: function() {
        PSLGEditorView.__super__.render.apply(this, arguments);
        this.el.className = "jupyter-widget pslg_widget";
        this.el.innerHTML = '';
	console.log("this.el", this.el);
        var width = this.model.get('width');
        var height = this.model.get('height');
        var svg = d3.select(this.el).append("svg")
            .attr("width", width )
            .attr("height", height)
            .attr("tabindex", 1);
        
        svg.append("rect")
            .attr("width", width)
            .attr("height", height)
            .attr("fill", "none");
        
        svg.append("path");
        
        this.el.appendChild(document.createElement('form'));
        this.el.children[1].innerHTML= '<label for="regionType">Region:</label> \
  <select id="regionType"></select><br>';
        this.el.appendChild(document.createElement('form'));
        this.el.children[2].innerHTML= '<label for="boundaryType">Boundary:</label> \
  <select id="boundaryType"></select><br>';
/*	this.el.appendChild(document.createElement('div'));
        this.el.children[3].innerHTML= '<p> \
    Click to add new vertex. Hold 'r' and click to add new \
    region. Hold 'h' and click to add new hole.  Click and drag \
    between two vertices to create a segment. Select an entity and \
    type backspace or delete to remove. Use the pull down menus to \
    set the boundary type for new vertices and segments and region type \
    for new regions. \
  </p>';*/

        d3.select(this.el.children[1].children[1])
            .selectAll("option")
            .data([1,2,3,0])
            .enter().append("option")
            .attr("value", function(d) { return d; })
            .text(function(d) { return d; });
        d3.select(this.el.children[2].children[1])
            .selectAll("option")
            .data([1,2,3,0])
            .enter().append("option")
            .attr("value", function(d) { return d; })
            .text(function(d) { return d; });
        
        this.vertices_changed();
        this.model.on('change:vertices', this.vertices_changed, this);
    },
    
    vertices_changed: function() {
        var that=this;
	console.log("vertices_changed");
	console.log(this);
	console.log(this.el);
	//console.log(this.el.children[1]);
	//console.log(this.el.children[1].children[1]);
        d3.select(this.el.children[1].children[1]).on("change",change);
        d3.select(this.el.children[2].children[1]).on("change",change);
        var width = this.model.get('width');
        var height = this.model.get('height');
        var Lx = this.model.get('Lx');
        var Ly = this.model.get('Ly');
        var x0 = this.model.get('x0');
        var y0 = this.model.get('y0');
        var pxOfx = d3.scale.linear()
            .domain([x0,Lx])
            .range([0,width]);
        var pyOfy = d3.scale.linear()
            .domain([y0,Ly])
            .range([height,0]);

        var verticesList = this.model.get('vertices')
        var vertices=[];
        if (verticesList) {
            vertices = d3.range(0,verticesList.length).map(function(i){
                return ([pxOfx(verticesList[i][0]), 
                         pyOfy(verticesList[i][1])])
            });
        }
        var dragged = null, selected = vertices[vertices.length-1], outsideBox=true;
        var line = d3.svg.line();
	console.log("svg");
	console.log(this.el);
        var svg = d3.select(this.el).select("svg");
        svg.select("rect")
            .attr("pointer-events", "all")
            .on("mousedown", mousedown);
        svg.select("path")
            .datum(vertices)
            .attr("class", "line")
            .attr("fill", "none")
            .attr("stroke", "steelblue")
            .call(redraw);
	console.log("window",window);
        d3.select(window)
            .on("mousemove", mousemove)
            .on("mouseup", mouseup)
            .on("keydown", keydown);
        svg.node().focus();

        function redraw() {
	    console.log("redraw");
            svg.select("path").attr("d", line);

            var circle = svg.selectAll("circle")
                .data(vertices, function(d) { return d; });

            circle.attr("fill","none")
                .attr("stroke", "steelblue")
                .attr("stroke-width", "1.5px");
            
            circle.enter().append("circle")
                .attr("r", 1e-6)
                .on("mousedown", function(d) { selected = dragged = d; redraw(); })
                .transition()
                .duration(750)
                .ease("elastic")
                .attr("r", 6.5);

            circle
                .classed("selected", function(d) { return d === selected; })
                .attr("cx", function(d) { return d[0]; })
                .attr("cy", function(d) { return d[1]; });

            circle.exit().remove();

            if (d3.event) {
                d3.event.preventDefault();
                d3.event.stopPropagation();
            }
        }
        
        function change() {
            line.interpolate(this.value);
            redraw();
        }
        
        function mousedown() {
            var mousePoint = selected = dragged = d3.mouse(svg.node());
            vertices.push(mousePoint);
            that.model.set("vertices",vertices.map(
                function(d){return [pxOfx.invert(d[0]),pyOfy.invert(d[1])]}));
            that.touch();
            redraw();
        }

        function mousemove() {
            if (!dragged) return;
            var m = d3.mouse(svg.node());
            dragged[0] = Math.max(0, Math.min(that.model.attributes.width, m[0]));
            dragged[1] = Math.max(0, Math.min(that.model.attributes.height, m[1]));
            redraw();
        }

        function mouseup() {
            if (!dragged) return;
            mousemove();
            dragged = null;
        }

        function keydown() {
            if (!selected) return;
            switch (d3.event.keyCode) {
            case 8: // backspace
            case 46: { // delete
                var i = vertices.indexOf(selected);
                vertices.splice(i, 1);
                selected = vertices.length ? vertices[i > 0 ? i - 1 : 0] : null;
                that.model.set("vertices", vertices.map(
                    function(d){return [pxOfx.invert(d[0]),pyOfy.invert(d[1])]}));
                that.touch();
                redraw();
                break;
            }
            }
        }
    },

});

module.exports = {
    PSLGEditorView: PSLGEditorView,
    PSLGEditorModel: PSLGEditorModel,
};
