import * as widgets from '@jupyter-widgets/base';
import * as d3 from 'd3';
const d3GetEvent = function() { return require("d3").event }.bind(this);
//const d3GetEvent = () => { return require("d3-selection").event };

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

export class PSLGEditorModel extends widgets.DOMWidgetModel {
    defaults() {
        return {...super.defaults(),
            _model_name: 'PSLGEditorModel',
            _view_name: 'PSLGEditorView',
            _model_module : 'ipymesh-widgets',
            _view_module : 'ipymesh-widgets',
            _model_module_version : '0.1.0',
            _view_module_version : '0.1.0',
            sync_toggle: true,
            width: 600,
            height: 600,
            Lx: 1.0,
            Ly: 1.0,
            image: new Uint8Array(0),
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
            regionTypes: []
        };
    }
    static serializers = {
        ...widgets.DOMWidgetModel.serializers,
        vertices: { deserialize: widgets.unpack_models },
        vertexFlags: { deserialize: widgets.unpack_models },
        segments: { deserialize: widgets.unpack_models },
        segmentFlags: { deserialize: widgets.unpack_models },
        regions: { deserialize: widgets.unpack_models },
        regionFlags: { deserialize: widgets.unpack_models },
        holes: { deserialize: widgets.unpack_models },
        boundaryTypes: { deserialize: widgets.unpack_models },
        regionTypes: { deserialize: widgets.unpack_models },
    }
}


export class PSLGEditorView extends widgets.DOMWidgetView {
    initialize () {
        super.initialize.apply(this, arguments);
        //this.setElement(document.createElementNS(d3.namespaces.svg, "g"));
        //this.d3el = d3.select(this.el);
    }

    render () {
        super.render.apply(this, arguments);
        this.el.className = "jupyter-widget pslg_widget";
        this.el.innerHTML = '';
        let width = this.model.get('width');
        let height = this.model.get('height');
        let image = this.model.get('image');

        this.svg = d3.select(this.el).append("svg")
            .attr("width", width )
            .attr("height", height)
            .attr("tabindex", 1)
            .style("background-color", "#FFF")
            .style("cursor", 'crosshair')
            .style("-webkit-user-select", "none")
            .style("-moz-user-select", "none")
            .style("-ms-user-select", "none")
            .style("-o-user-select", "none")
            .style("user-select", "none");
        if (image.byteLength > 0) {
            //let blob = new Blob([this.model.get('value')], {type: `image/${this.model.get('format')}`});
            let blob = new Blob([image], {type: "image/png"});
            let url = URL.createObjectURL(blob);
            this.svg.append("defs")
            .append("pattern")
            .attr('id', 'locked2')
            .attr('patternUnits', 'userSpaceOnUse')
            .attr('width', width)
            .attr('height', height)
            .attr("id", "bg")
            .append("image")
            .attr("href", url)
            //.attr("xlink:href", image)
            .attr('width', width)
            .attr('height', height);
            this.svg.append("rect")
            .attr("width", width)
            .attr("height", height)
            .attr("fill", "url(#bg)");
        }
        else {
            this.svg.append("rect")
            .attr("width", width)
            .attr("height", height)
            .attr("fill", "none");
        }

        this.svg.append("path");

        // only respond once per keydown
        this.lastKeyDown = -1;

        //color scale for region and boundary types
        this.colors = d3.scaleOrdinal(d3.schemeCategory10);

        this.el.appendChild(document.createElement('form'));
        this.el.children[1].innerHTML= '<label for="regionType">Region:</label> \
  <select id="regionType"></select><br>';
        this.el.appendChild(document.createElement('form'));
        this.el.children[2].innerHTML= '<label for="boundaryType">Boundary:</label> \
  <select id="boundaryType"></select><br>';
        this.el.appendChild(document.createElement('form'));
        this.el.children[3].innerHTML= 'x: <input type="number" id="x">';
        this.el.appendChild(document.createElement('form'));
        this.el.children[4].innerHTML= 'y: <input type="number" id="y">';
        this.el.appendChild(document.createElement('div'));
        this.el.children[5].innerHTML= '<p> \
    Click to add new vertex. Hold the r key and click to add new \
    region. Hold the h key and click to add new hole.  Click and drag \
    between two vertices to create a segment. Select an entity and \
    type delete to remove. Use the pull down menus to \
    set the boundary type for new vertices and segments and region type \
    for new regions. To move a vertex, region, or hole select it, type coordinates, and return. \
  </p>';

        this.regionTypes = this.model.get('regionTypes');
        this.boundaryTypes = this.model.get('boundaryTypes');
        d3.select(this.el.children[1].children[1])
            .selectAll("option")
            .data(this.regionTypes)
            .enter()
            .append("option")
            .attr("type", "number")
            .style("font","12px sans-serif")
            .style("pointer-events","none")
            .text((d) => { return d; })
            .attr("value", (d) => { return d; });

        d3.select(this.el.children[2].children[1])
            .selectAll("option")
            .data(this.boundaryTypes)
            .enter()
            .append("option")
            .attr("type", "number")
            .style("font","12px sans-serif")
            .style("pointer-events","none")
            .text((d) => { return d; })
            .attr("value", (d) => { return d; });

        this.regionType = this.regionTypes[0];
        this.boundaryType = this.boundaryTypes[0];

        this.graph_changed();

        this.model.on('change:sync_toggle', this.python_changed, this);
    }

    python_changed () {
        d3.select(this.el).selectAll(".vertex").remove();
        d3.select(this.el).selectAll(".segment").remove();
        d3.select(this.el).selectAll(".region").remove();
        d3.select(this.el).selectAll(".hole").remove();
        d3.select(this.el).selectAll(".id").remove();
        this.graph_changed();
    }

    graph_changed () {
        let width = this.model.get('width');
        let height = this.model.get('height');
        let Lx = this.model.get('Lx');
        let Ly = this.model.get('Ly');
        let x0 = this.model.get('x0');
        let y0 = this.model.get('y0');
        this.pxOfx = d3.scaleLinear()
            .domain([x0, Lx])
            .range([0, width]);
        this.pyOfy = d3.scaleLinear()
            .domain([y0, Ly])
            .range([height, 0]);
        let verticesList = this.model.get('vertices');
        let vertexFlagsList = this.model.get('vertexFlags');
        this.vertices = [];
        if (verticesList) {
            this.vertices = d3.range(0, verticesList.length).map((i) => {
                return {id: i,
                        x: this.pxOfx(verticesList[i][0]),
                        y: this.pyOfy(verticesList[i][1]),
                        type: vertexFlagsList[i]
                       };
            });
        }
        this.lastVertexId = verticesList.length;

        let segmentsList = this.model.get('segments');
        let segmentFlagsList = this.model.get('segmentFlags');
        this.segments = [];
        if (segmentsList) {
            this.segments = d3.range(0, segmentsList.length).map((i) => {
                return {source: this.vertices[segmentsList[i][0]],
                        target: this.vertices[segmentsList[i][1]],
                        type: segmentFlagsList[i]
                       };
            });
        }

        let regionsList = this.model.get('regions');
        let regionFlagsList = this.model.get('regionFlags');
        this.regions = [];
        if (regionsList) {
            this.regions = d3.range(0, regionsList.length).map((i) => {
                return {id: i,
                        x: this.pxOfx(regionsList[i][0]),
                        y: this.pyOfy(regionsList[i][1]),
                        type: regionFlagsList[i]
                       };
            });
        }
        this.lastRegionId = regionsList.length;

        let holesList = this.model.get('holes')
        this.holes = [];
        if (holesList) {
            this.holes = d3.range(0, holesList.length).map((i) => {
                return {id: i,
                        x: this.pxOfx(holesList[i][0]),
                        y: this.pyOfy(holesList[i][1]),
                       };
            });
        }
        this.lastHoleId = holesList.length;

        // line displayed when dragging new vertices
        this.drag_line = this.svg.append('svg:path')
            .style('stroke', (d) => {return this.colors(this.boundaryType);})
            //.attr('class', 'segment dragline hidden')
            .style('stroke-dasharray', '10,2')
            .style('stroke-width', '4px')
            .attr('d', 'M0,0L0,0');

        // handles to segment and vertex element groups
        this.segment = this.svg.append('svg:g').selectAll('.segment');
        this.vertex = this.svg.append('svg:g').selectAll('.vertex');
        this.region = this.svg.append('svg:g').selectAll('.region');
        this.hole = this.svg.append('svg:g').selectAll('.hole');

        // mouse event vars
        this.selected_vertex = null;
        this.selected_region = null;
        this.selected_hole = null;
        this.selected_segment = null;
        this.mousedown_segment = null;
        this.mousedown_vertex = null;
        this.mouseup_vertex = null;
        this.mousedown_region = null;
        this.mouseup_region = null;
        this.mousedown_hole = null;
        this.mouseup_hole = null;

        let that = this;

        const mousedown = () => {
            // prevent I-bar on drag
            //d3.event.preventDefault();

            // because :active only works in WebKit?
            that.svg.classed('active', true);

            if (d3GetEvent().ctrlKey || that.mousedown_vertex || that.mousedown_segment || that.mousedown_region || that.mousedown_hole) return;

            // insert new vertex, region, or hole at point
            let point = d3.mouse(that.el);
            if (that.lastKeyDown == 82) {
                let new_region = {id: ++that.lastRegionId, x:point[0], y:point[1], type:that.regionType};
                that.regions.push(new_region);
            }
            else if (that.lastKeyDown == 72) {
                let new_hole = {id: ++that.lastHoleId, x:point[0], y:point[1]};
                that.holes.push(new_hole);
            } else {
                let new_vertex = {id: ++that.lastVertexId, x:point[0], y:point[1], type:that.boundaryType};
                that.vertices.push(new_vertex);
            }
            that.updateBackend();
            that.restart();
        }

        const mouseup = () => {
            if (that.mousedown_vertex) {
                // hide drag line
                that.drag_line
                    .classed('hidden', true);
            }

            // because :active only works in WebKit?
            that.svg.classed('active', false);

            // clear mouse event vars
            that.resetMouseVars();
        }

        const mousemove = function () {
            if (!that.mousedown_vertex) return;

            // update drag line
            that.drag_line
                .style('stroke', (d) => { return that.colors(that.boundaryType);} )
                .attr('d', 'M' + that.mousedown_vertex.x + ',' + that.mousedown_vertex.y + 'L' + d3.mouse(this)[0] + ',' + d3.mouse(this)[1]);
            that.restart();
        }

        const keydown = () => {
            let is_digit = d3GetEvent().keyCode <= 57 && d3GetEvent().keyCode >= 48;
            if (is_digit) {
                return;//for typing in numbers into x and y input areas:0-9 + ',' + backspace
            }
            else if (d3GetEvent().keyCode == 190) {//decimal
                return;
            }
            else if (d3GetEvent().keyCode == 8){//backspace
                return;
            }
            else if (d3GetEvent().keyCode == 13) {//enter
                //trigger point move on enter/return
                x_changed();
                y_changed();
            }
            d3GetEvent().preventDefault();
            if (that.lastKeyDown !== -1) return;
            that.lastKeyDown = d3GetEvent().keyCode;

            // ctrl
            if(d3GetEvent().keyCode === 17) {
                that.svg.classed('ctrl', true);
            }

            if (!that.selected_vertex && !that.selected_segment && !that.selected_region && !that.selected_hole) return;
            switch (d3GetEvent().keyCode) {
                case 46: // delete
                    if (that.selected_vertex) {
                        that.vertices.splice(that.vertices.indexOf(that.selected_vertex), 1);
                        that.spliceSegmentsForVertex(that.selected_vertex);
                        that.updateBackend();
                    } else if (that.selected_region) {
                        that.regions.splice(that.regions.indexOf(that.selected_region), 1);
                        that.updateBackend();
                    } else if (that.selected_hole) {
                        that.holes.splice(that.holes.indexOf(that.selected_hole), 1);
                        that.updateBackend();
                    } else if (that.selected_segment) {
                        that.segments.splice(that.segments.indexOf(that.selected_segment), 1);
                        that.updateBackend();
                    }
                    that.selected_segment = null;
                    that.selected_vertex = null;
                    that.selected_region = null;
                    that.selected_hole = null;
                    that.restart();
                    break;
            }
        }

        const keyup = () => {
            that.lastKeyDown = -1;

            // ctrl
            if (d3GetEvent().keyCode === 17) {
                that.vertex.on('mousedown.drag', null)
                           .on('touchstart.drag', null);
                that.svg.classed('ctrl', false);
            }
        }

        const region_changed = function () {
            that.regionType = Number(this.value);
            that.restart();
        }

        const boundary_changed = function () {
            that.boundaryType = Number(this.value);
            that.restart();
        }

        const x_changed = () => {
            if (this.selected_vertex) {
                this.selected_vertex.x = this.pxOfx(d3.select("#x").nodes()[0].value);
                this.updateBackend();
                this.restart();
            }
            else if (this.selected_region) {
                this.selected_region.x = this.pxOfx(d3.select("#x").nodes()[0].value);
                this.updateBackend();
                this.restart();
            }
            else if(this.selected_hole) {
                this.selected_hole.x = this.pxOfx(d3.select("#x").nodes()[0].value);
                this.updateBackend();
                this.restart();
            }
        }

        const y_changed = () => {
            if (this.selected_vertex) {
                this.selected_vertex.y = this.pyOfy(d3.select("#y").nodes()[0].value);
                this.updateBackend();
                this.restart();
            }
            else if (this.selected_region) {
                this.selected_region.y = this.pyOfy(d3.select("#y").nodes()[0].value);
                this.updateBackend();
                this.restart();
            }
            else if (this.selected_hole) {
                this.selected_hole.y = this.pyOfy(d3.select("#y").nodes()[0].value);
                this.updateBackend();
                this.restart();
            }
        }

        d3.select(this.el.children[1].children[1]).on("change", region_changed);
        d3.select(this.el.children[2].children[1]).on("change", boundary_changed);
        d3.select(this.el.children[3]).on("change", x_changed);
        d3.select(this.el.children[4]).on("change", y_changed);
        this.svg.on('mousedown', mousedown)
            .on('mousemove', mousemove)
            .on('mouseup', mouseup);
        d3.select(window)
            .on('keydown', keydown)
            .on('keyup', keyup);
        this.restart();
    }

    // update graph (called when needed)
    restart () {
        // segment group
        d3.select(this.el).selectAll(".segment").remove();
        let segment = this.segment.data(this.segments);

        // update existing segments
        segment .classed('selected', (d) => { return d === this.selected_segment; })
                .style('stroke-dasharray', (d) => { return d === this.selected_segment ? "10,2" : null;});
        // add new segments
        let s = segment.enter().append('svg:path')
        s.attr('class', 'segment')
                .classed('selected', (d) => { return d === this.selected_segment; })
                .style('stroke', (d) => {return this.colors(d.type);})
                .style('stroke-dasharray', (d) => { return d === this.selected_segment ? "10,2" : null;})
                .on('mousedown', (d) => {
                    if (d3GetEvent().ctrlKey) return;
                    // select segment
                    this.mousedown_segment = d;
                    if (this.mousedown_segment === this.selected_segment) this.selected_segment = null;
                    else this.selected_segment = this.mousedown_segment;
                    this.selected_vertex = null;
                    this.selected_region = null;
                    this.selected_hole = null;
                    this.restart();
                });

        // remove old segments
        segment.exit().remove();

        // vertex group
        d3.select(this.el).selectAll(".vertex").remove();
        d3.select(this.el).selectAll(".id").remove();
        // NB: the function arg is crucial here! vertices are known by id, not by index!
        let vertex = this.vertex.data(this.vertices, (d) => { return d.id; });

        // update existing vertices
        this.vertex.style('fill', (d) => { return (d === this.selected_vertex) ? d3.rgb(this.colors(d.type)).brighter().toString() : this.colors(d.type); });

        // add new vertices
        let v = vertex.enter().append('svg:g');

        v.append('svg:circle')
                .attr('class', 'vertex')
                .attr('r', 12)
                .style('fill', (d) => { return (d === this.selected_vertex) ? d3.rgb(this.colors(d.type)).brighter().toString() : this.colors(d.type); })
                .style('stroke', (d) => { return d3.rgb(this.colors(d.type)).darker().toString(); })
                .on('mouseover', (d, i, nodes) => {
                    d3.select(nodes[i]).attr('transform', 'scale(1.1)');
                })
                .on('mouseout', (d, i, nodes) => {
                    d3.select(nodes[i]).attr('transform', '');
                })
                .on('mousedown', (d) => {
                    if (d3GetEvent().ctrlKey) return;
                    // select vertex
                    this.mousedown_vertex = d;
                    if (this.mousedown_vertex === this.selected_vertex) this.selected_vertex = null;
                    else {
                        this.selected_vertex = this.mousedown_vertex;
                        d3.select("#x").nodes()[0].value = this.pxOfx.invert(this.selected_vertex.x);
                        d3.select("#y").nodes()[0].value = this.pyOfy.invert(this.selected_vertex.y);
                    }
                    this.selected_segment = null;
                    this.selected_region = null;
                    this.selected_hole = null;
                    // reposition drag line
                    this.drag_line
                        .classed('hidden', false)
                        .style('stroke', (d) => {return this.colors(this.boundaryType);})
                        .attr('d', 'M' + this.mousedown_vertex.x + ',' + this.mousedown_vertex.y + 'L' + this.mousedown_vertex.x + ',' + this.mousedown_vertex.y);
                    this.restart();
                })
                .on('mouseup', (d, i, nodes) => {
                    if (!this.mousedown_vertex) return;

                    // needed by FF
                    this.drag_line
                        .classed('hidden', true);
                    // check for drag-to-self
                    this.mouseup_vertex = d;
                    if (this.mouseup_vertex === this.mousedown_vertex) {
                        this.resetMouseVars();
                        return;
                    }
                    // unenlarge target vertex
                    d3.select(nodes[i]).attr('transform', '');
                    // add segment to graph (update if exists)
                    // NB: segments are strictly source < target; arrows separately specified by booleans
                    let source, target;
                    if (this.mousedown_vertex.id < this.mouseup_vertex.id) {
                        source = this.mousedown_vertex;
                        target = this.mouseup_vertex;
                    }
                    else {
                        source = this.mouseup_vertex;
                        target = this.mousedown_vertex;
                    }

                    let segment = this.segments.filter((l) => {
                        return (l.source === source && l.target === target);
                    })[0];

                    if(!segment) {
                        segment = {source: source, target: target, left: false, right: false, type: this.boundaryType};
                        this.segments.push(segment);
                        this.updateBackend();
                    }
                    // select new segment
                    this.selected_segment = segment;
                    this.selected_vertex = null;
                    this.selected_region = null;
                    this.selected_hole = null;
                    this.restart();
                });

        // show vertex IDs
        v.append('svg:text')
                .attr('x', 0)
                .attr('y', 4)
                .attr('class', 'id')
                .style("font","12px sans-serif")
                .style("pointer-events","none")
                .style("text-anchor","middle")
                .style("font-weight","bold")
                .text((d) => { return d.type; });

        // remove old vertices
        vertex.exit().remove();

        // region group
        d3.select(this.el).selectAll(".region").remove();
        // NB: the function arg is crucial here! regions are known by id, not by index!
        let region = this.region.data(this.regions, (d) => { return d.id; });

        // update existing regions
        this.region
            .style('fill', (d) => { return (d === this.selected_region) ? d3.rgb(this.colors(d.type)).brighter().toString() : this.colors(d.type); });

        // add new regions
        let r = region.enter().append('svg:g');

        r.append('svg:rect')
            .attr('class', 'region')
            .attr('width', 24)
            .attr('height', 24)
            .style('fill', (d) => { return (d === this.selected_region) ? d3.rgb(this.colors(d.type)).brighter().toString() : this.colors(d.type); })
            .style('stroke', (d) => { return d3.rgb(this.colors(d.type)).darker().toString(); })
            .on('mouseover', (d, i, nodes) => {
                    d3.select(nodes[i]).attr('transform', 'scale(1.1)');
                })
                .on('mouseout', (d, i, nodes) => {
                    d3.select(nodes[i]).attr('transform', '');
                })
                .on('mousedown', (d) => {
                    if (d3GetEvent().ctrlKey) return;
                    // select region
                this.mousedown_region = d;
                if (this.mousedown_region === this.selected_region) this.selected_region = null;
                else {
                    this.selected_region = this.mousedown_region;
                    d3.select("#x").nodes()[0].value = this.pxOfx.invert(this.selected_region.x);
                    d3.select("#y").nodes()[0].value = this.pyOfy.invert(this.selected_region.y);
                }
                this.selected_segment = null;
                this.selected_vertex = null;
                this.selected_hole = null;
                this.restart();
                })
                .on('mouseup', (d, i, nodes) => {
                    if (!this.mousedown_region) return;
                    // check for drag-to-self or click-self
                    this.mouseup_region = d;
                    if (this.mouseup_region === this.mousedown_region) {
                        this.resetMouseVars();
                        return;
                    }
                    // unenlarge target vertex
                    d3.select(nodes[i]).attr('transform', '');

                    this.selected_segment = null;
                    this.selected_vertex = null;
                    this.selected_region = null;
                    this.selected_hole = null;
                    this.restart();
                });


        // show region IDs
        r.append('svg:text')
            .attr('x', 12)
            .attr('y', 16)
            .attr('class', 'id')
            .style("font","12px sans-serif")
            .style("pointer-events","none")
            .style("text-anchor","middle")
            .style("font-weight","bold")
            .text((d) => { return d.type; });

        // remove old regions
        region.exit().remove();

        // hole group
        d3.select(this.el).selectAll(".hole").remove();
        // NB: the function arg is crucial here! holes are known by id, not by index!
        let hole = this.hole.data(this.holes, (d) => { return d.id; });

        // update existing holes
        this.hole
            .style('fill', (d) => { return (d === this.selected_hole) ? d3.rgb('#808080').brighter().toString() : '#808080'; });

        // add new holes
        let h = hole.enter().append('svg:g');

        h.append('svg:polyline')
            .attr('class', 'hole')
            .classed('selected', (d) => { return d === this.selected_hole; })
            .attr('points','0,24 12,0 24,24')
            .style('stroke', (d) => { return d3.rgb('#808080').darker().toString(); })
            .style('fill', (d) => { return (d === this.selected_hole) ? d3.rgb('#808080').brighter().toString() : d3.rgb('#808080'); })
            .on('mouseover', (d, i, nodes) => {
                d3.select(nodes[i]).attr('transform', 'scale(1.1)');
            })
            .on('mouseout', (d, i, nodes) => {
                d3.select(nodes[i]).attr('transform', '');
            })
            .on('mousedown', (d) => {
                if (d3GetEvent().ctrlKey) return;
                // select hole
                this.mousedown_hole = d;
                if (this.mousedown_hole === this.selected_hole) this.selected_hole = null;
                else {
                    this.selected_hole = this.mousedown_hole;
                    d3.select("#x").nodes()[0].value = this.pxOfx.invert(this.selected_hole.x);
                    d3.select("#y").nodes()[0].value = this.pyOfy.invert(this.selected_hole.y);
                }
                this.selected_segment = null;
                this.selected_vertex = null;
                this.selected_region = null;

                this.restart();
            })
            .on('mouseup', (d, i, nodes) => {
                if (!this.mousedown_hole) return;
                // check for drag-to-self or click-self
                this.mouseup_hole = d;
                if (this.mouseup_hole === this.mousedown_hole) {
                    this.resetMouseVars();
                    return;
                }
                // unenlarge target vertex
                d3.select(nodes[i]).attr('transform', '');
                this.selected_segment = null;
                this.selected_vertex = null;
                this.selected_region = null;
                this.selected_hole = null;
                this.restart();
            });

        // remove old holes
        hole.exit().remove();

        // redraw graph
        this.redraw(s, v, r, h);
        //debugging
        //dump .poly to console
        /*
        console.log(vertices.length,2,0,1);
        console.log("#vertices");
        for (var i=0; i<vertices.length;i++) {
            console.log(i,vertices[i].x, vertices[i].y,vertices[i].type);
        }
        segments=segments;
        console.log(segments.length,1);
        console.log("#segments");
        for (var i=0;i<segments.length;i++) {
            console.log(i,vertices.indexOf(segments[i].source),vertices.indexOf(segments[i].target),segments[i].type);
        }
        console.log("#holes");
        console.log(holes.length);
        for (var i=0;i<holes.length;i++) {
            console.log(i,holes[i].x,holes[i].y);
        }
        console.log(regions.length,1);
        console.log("#regions");
        for (var i=0;i<regions.length;i++) {
        console.log(i,regions[i].x,regions[i].y,regions[i].type);
        }*/
    }

    redraw (segment, vertex, region, hole) {
        segment.style("fill","none")
            .style("stroke-width","4px")
            .style("cursor","pointer")
            .attr('d', (d) => {
                let deltaX = d.target.x - d.source.x,
                    deltaY = d.target.y - d.source.y,
                    dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY),
                    normX = deltaX / dist,
                    normY = deltaY / dist,
                    sourcePadding = 12,
                    targetPadding = 12,
                    sourceX = d.source.x + (sourcePadding * normX),
                    sourceY = d.source.y + (sourcePadding * normY),
                    targetX = d.target.x - (targetPadding * normX),
                    targetY = d.target.y - (targetPadding * normY);
                return 'M' + sourceX + ',' + sourceY + 'L' + targetX + ',' + targetY;
            });

        vertex.style("stroke-width", "1.5px")
            .style("cursor","pointer")
            .attr('transform', (d) => {
                return 'translate(' + d.x + ',' + d.y + ')';
            });

        region.style("stroke-width","1.5px")
            .style("cursor","pointer")
            .attr('transform', (d) => {
                return 'translate(' + (d.x-12) + ',' + (d.y-12) + ')';
            });

        hole.style("stroke-width","1.5px")
            .style("cursor","pointer")
            .attr('transform', (d) => {
                return 'translate(' + (d.x-12) + ',' + (d.y-12) + ')';
            });
    }

    updateBackend () {
        //sync with backend
        this.model.set("vertices", this.vertices.map((d) => {
            return [this.pxOfx.invert(d.x), this.pyOfy.invert(d.y)];
        }));
        this.model.set("vertexFlags", this.vertices.map((d) => {
            return d.type;
        }));
        this.model.set("segments", this.segments.map((d) => {
            return [this.vertices.indexOf(d.source), this.vertices.indexOf(d.target)];
        }));
        this.model.set("segmentFlags", this.segments.map((d) => {
            return d.type
        }));
        this.model.set("holes", this.holes.map((d) => {
            return [this.pxOfx.invert(d.x), this.pyOfy.invert(d.y)];
        }));
        this.model.set("regions", this.regions.map((d) => {
            return [this.pxOfx.invert(d.x), this.pyOfy.invert(d.y)];
        }));
        this.model.set("regionFlags", this.regions.map((d) => {
            return d.type;
        }));
        this.touch();
    }

    resetMouseVars () {
        this.mousedown_vertex = null;
        this.mouseup_vertex = null;
        this.mousedown_region = null;
        this.mouseup_region = null;
        this.mousedown_hole = null;
        this.mouseup_hole = null;
        this.mousedown_segment = null;
    }


    spliceSegmentsForVertex (vertex) {
        let toSplice = this.segments.filter((l) => {
            return (l.source === vertex || l.target === vertex);
        });
        toSplice.map((l) => {
            this.segments.splice(this.segments.indexOf(l), 1);
        });
    }

    boundaryType: any;
    boundaryTypes: any;
    colors: any;
    drag_line: any;
    hole: any;
    holes: any;
    lastKeyDown: any;
    lastHoleId: any;
    lastRegionId: any;
    lastVertexId: any;
    mousedown_hole: any;
    mousedown_region: any;
    mousedown_segment: any;
    mousedown_vertex: any;
    mouseup_hole: any;
    mouseup_region: any;
    mouseup_segment: any;
    mouseup_vertex: any;
    pxOfx: any;
    pyOfy: any;
    region: any;
    regions: any;
    regionType: any;
    regionTypes: any;
    segment: any;
    segments: any;
    selected_hole : any;
    selected_region : any;
    selected_segment : any;
    selected_vertex: any;
    svg: any;
    vertex: any;
    vertices: any;
}
