import * as widgets from '@jupyter-widgets/base';
import * as d3 from 'd3';
import { VisibilityPolygon } from './visibility';

export class PSLGEditorModel extends widgets.DOMWidgetModel {
    defaults() {
        return {...super.defaults(),
            _model_name: 'PSLGEditorModel',
            _view_name: 'PSLGEditorView',
            _model_module : 'ipymesh-widgets',
            _view_module : 'ipymesh-widgets',
            _model_module_version : '0.1.4',
            _view_module_version : '0.1.4',
        };
    }
    static serializers = {
        ...widgets.DOMWidgetModel.serializers,
    }
}


export class PSLGEditorView extends widgets.DOMWidgetView {
    initialize () {
        super.initialize.apply(this, arguments);
        this.visibilityPolygon = new VisibilityPolygon();
    }

    render () {
        super.render.apply(this, arguments);
        this.el.className = "jupyter-widget pslg_widget";

        this.width = this.model.get('width');
        this.height = this.model.get('height');
        let image = this.model.get('image');
        let Lx = this.model.get('Lx');
        let Ly = this.model.get('Ly');
        let x0 = this.model.get('x0');
        let y0 = this.model.get('y0');
        this.boundary_type = this.model.get('boundary_type');
        this.region_type = this.model.get('region_type');
        this.add_new = 'vertex';
        this.pxOfx = d3.scaleLinear()
            .domain([x0, Lx])
            .range([0, this.width]);
        this.pyOfy = d3.scaleLinear()
            .domain([y0, Ly])
            .range([this.height, 0]);

        this.colors = d3.scaleOrdinal(d3.schemeCategory10);

        this.svg = d3.select(this.el)
            .append('svg')
            .on('contextmenu', () => { d3.event.preventDefault(); })
            .attr('width', this.width)
            .attr('height', this.height)
            .attr("tabindex", 1); // can be focused on

        if (image.byteLength > 0) {
            let blob = new Blob([image], {type: "image/png"});
            let url = URL.createObjectURL(blob);
            this.svg.append("defs")
            .append("pattern")
            .attr('id', 'locked2')
            .attr('patternUnits', 'userSpaceOnUse')
            .attr('width', this.width)
            .attr('height', this.height)
            .attr("id", "bg")
            .append("image")
            .attr("href", url)
            .attr('width', this.width)
            .attr('height', this.height);
            this.svg.append("rect")
            .attr("width", this.width)
            .attr("height", this.height)
            .attr("fill", "url(#bg)");
        }
        else {
            this.svg.append("rect")
            .attr("width", this.width)
            .attr("height", this.height)
            .attr("fill", "none");
        }

        this.vertices = [];
        this.lastVertexId = 0;
        this.segments = [];
        this.regions = [];
        this.lastRegionId = 0;
        this.holes = [];
        this.lastHoleId = 0;

        this.python_changed();

        this.selectedVertex = null;
        this.selectedRegion = null;
        this.selectedHole = null;
        this.selectedSegment = null;
        this.mousedownVertex = null;
        this.mousedownSegment = null;
        this.mousedownRegion = null;
        this.mousedownHole = null;
        this.mouseupVertex = null;
        this.mouseupRegion = null;
        this.mouseupHole = null;

        this.drag = d3.drag()
            // Mac Firefox doesn't distinguish between left/right click when CTRL is held
            .filter(() => d3.event.button === 0 || d3.event.button === 2)
            .on('start', (d) => {
                if (d.is === 'vertex') {
                    this.selectedVertex = d;
                    this.selectedRegion = null;
                    this.selectedHole = null;
                    this.selectedSegment = null;
                }
                else if (d.is === 'region') {
                    this.selectedVertex = null;
                    this.selectedRegion = d;
                    this.selectedHole = null;
                    this.selectedSegment = null;
                }
                else if (d.is === 'hole') {
                    this.selectedVertex = null;
                    this.selectedRegion = null;
                    this.selectedHole = d;
                    this.selectedSegment = null;
                }
                this.restart();
            })
            .on('drag', (d) => {
                d.x = d3.event.x;
                d.y = d3.event.y;
                if (d.is === 'hole' || d.is === 'region') {
                    this.get_visibility(d.x, d.y);
                }
                this.redraw();
                this.model.set('xy', [this.pxOfx.invert(d.x), this.pyOfy.invert(d.y)]);
                this.touch();
            })
            .on('end', (d) => {
                this.update_backend();
                this.polygon.attr('points', []);
                this.redraw();
            });

        // line displayed when dragging new nodes
        this.dragLine = this.svg.append('svg:path')
          .attr('class', 'segment dragline hidden')
          .attr('d', 'M0,0L0,0');

        // only respond once per keydown
        this.lastKeyDown = -1;

        // app starts here
        this.svg.on('mousedown', this.mousedown())
            .on('mousemove', this.mousemove())
            .on('mouseup', this.mouseup());
        d3.select(this.el)
            .on('keydown', this.keydown())
            .on('keyup', this.keyup());
        this.restart();

        this.model.on('change:boundary_type', () => {this.boundary_type = this.model.get("boundary_type");}, this);
        this.model.on('change:region_type', () => {this.region_type = this.model.get("region_type");}, this);
        this.model.on('change:add_new', () => {this.add_new = this.model.get("add_new");}, this);
        this.model.on('change:_sync_toggle', () => {this.python_changed(); this.restart();}, this);
        this.model.on('change:xy', () => {this.position_changed();}, this);
    }

    // update graph (called when needed)
    restart() {
        // path (segment) group
        this.path = this.path.data(this.segments);

        // update existing segments
        this.path.classed('selected', (d) => d === this.selectedSegment);

        // remove old segments
        this.path.exit().remove();

        // add new segments
        this.path = this.path.enter().append('svg:path')
            .attr('class', 'segment')
            .style('stroke', (d) => this.colors(d.type))
            .classed('selected', (d) => d === this.selectedSegment)
            .on('mousedown', (d) => {
                if (d3.event.ctrlKey) return;

                // select segment
                this.mousedownSegment = d;
                this.selectedSegment = (this.mousedownSegment === this.selectedSegment) ? null : this.mousedownSegment;
                this.selectedVertex = null;
                this.restart();
            })
            .merge(this.path);

        // circle (vertex) group
        // NB: the function arg is crucial here! vertices are known by id, not by index!
        this.circle = this.circle.data(this.vertices, (d) => d.id);

        // update existing vertices (selected visual states)
        this.circle.selectAll('circle')
            .style('fill', (d) => (d === this.selectedVertex) ? d3.rgb(this.colors(d.type)).brighter().toString() : this.colors(d.type));

        // remove old vertices
        this.circle.exit().remove();

        // add new vertices
        let g = this.circle.enter().append('svg:g')
            .attr('transform', (d) => {
                return 'translate(' + d.x + ',' + d.y + ')';
            });

        g.append('svg:circle')
            .attr('class', 'vertex')
            .attr('r', 12)
            .style('fill', (d) => (d === this.selectedVertex) ? d3.rgb(this.colors(d.type)).brighter().toString() : this.colors(d.type))
            .style('stroke', (d) => d3.rgb(this.colors(d.type)).darker().toString())
            .on('mouseover', (d) => {
                // enlarge target vertex
                d3.select(d3.event.currentTarget).attr('transform', 'scale(1.1)');
            })
            .on('mouseout', (d) => {
                // unenlarge target vertex
                d3.select(d3.event.currentTarget).attr('transform', '');
            })
            .on('mousedown', (d) => {
                if (d3.event.ctrlKey) return;

                // select vertex
                this.mousedownVertex = d;
                this.selectedVertex = (this.mousedownVertex === this.selectedVertex) ? null : this.mousedownVertex;
                this.selectedSegment = null;
                this.selectedRegion = null;
                this.selectedHole = null;
                if (this.selectedVertex) {
                    this.model.set('xy', [this.pxOfx.invert(this.selectedVertex.x), this.pyOfy.invert(this.selectedVertex.y)]);
                    this.touch();
                }

                // reposition drag line
                this.dragLine
                    .classed('hidden', false)
                    .attr('d', `M${this.mousedownVertex.x},${this.mousedownVertex.y}L${this.mousedownVertex.x},${this.mousedownVertex.y}`)
                    .style('stroke', (d) => this.colors(this.boundary_type));

                this.restart();
            })
            .on('mouseup', (d) => {
                if (!this.mousedownVertex) return;

                // needed by FF
                this.dragLine
                    .classed('hidden', true);

                // check for drag-to-self
                this.mouseupVertex = d;
                if (this.mouseupVertex === this.mousedownVertex) {
                    this.resetMouseVars();
                    return;
                }

                // unenlarge target vertex
                d3.select(d3.event.currentTarget).attr('transform', '');

                // add segment to graph (update if exists)
                // NB: segments are strictly source < target
                let isRight = this.mousedownVertex.id < this.mouseupVertex.id;
                let source = isRight ? this.mousedownVertex : this.mouseupVertex;
                let target = isRight ? this.mouseupVertex : this.mousedownVertex;

                const segment = this.segments.filter((l) => l.source === source && l.target === target)[0];
                if (!segment) {
                      this.segments.push({source: source, target: target, type: this.boundary_type, is: 'segment'});
                      this.update_backend();
                }

                // select new segment
                this.selectedSegment = segment;
                this.selectedVertex = null;
                this.selectedRegion = null;
                this.selectedHole = null;
                this.restart();
            });

        // show vertex IDs
        g.append('svg:text')
            .attr('x', 0)
            .attr('y', 4)
            .attr('class', 'id')
            .text((d) => d.type);

        this.circle = g.merge(this.circle);

        // rect (region) group
        // NB: the function arg is crucial here! vertices are known by id, not by index!
        this.rect = this.rect.data(this.regions, (d) => d.id);

        // update existing regions (selected visual states)
        this.rect.selectAll('rect')
            .style('fill', (d) => (d === this.selectedRegion) ? d3.rgb(this.colors(d.type)).brighter().toString() : this.colors(d.type));

        // remove old regions
        this.rect.exit().remove();

        // add new regions
        let r = this.rect.enter().append('svg:g')
            .attr('transform', (d) => {
                return 'translate(' + (d.x-12) + ',' + (d.y-12) + ')';
            });

        r.append('svg:rect')
            .attr('class', 'region')
            .attr('width', 24)
            .attr('height', 24)
            .style('fill', (d) => (d === this.selectedRegion) ? d3.rgb(this.colors(d.type)).brighter().toString() : this.colors(d.type))
            .style('stroke', (d) => d3.rgb(this.colors(d.type)).darker().toString())
            .on('mouseover', (d) => {
                d3.select(d3.event.currentTarget).attr('transform', 'scale(1.1)');
            })
            .on('mouseout', (d) => {
                d3.select(d3.event.currentTarget).attr('transform', '');
            })
            .on('mousedown', (d) => {
                if (d3.event.ctrlKey) return;

                // select vertex
                this.mousedownRegion = d;
                this.selectedRegion = (this.mousedownRegion === this.selectedRegion) ? null : this.mousedownRegion;
                this.selectedSegment = null;
                this.selectedVertex = null;
                this.selectedHole = null;
                if (this.selectedRegion) {
                    this.model.set('xy', [this.pxOfx.invert(this.selectedRegion.x), this.pyOfy.invert(this.selectedRegion.y)]);
                    this.touch();
                }

                this.restart();
            })
            .on('mouseup', (d) => {
                if (!this.mousedownRegion) return;

                // check for drag-to-self
                this.mouseupRegion = d;
                if (this.mouseupRegion === this.mousedownRegion) {
                    this.resetMouseVars();
                    return;
                }

                // unenlarge target vertex
                d3.select(d3.event.currentTarget).attr('transform', '');

                // select new segment
                this.selectedSegment = null;
                this.selectedVertex = null;
                this.selectedRegion = null;
                this.selectedHole = null;

                this.restart();
            });

        // show vertex IDs
        r.append('svg:text')
            .attr('x', 12)
            .attr('y', 16)
            .attr('class', 'id')
            .text((d) => d.type);

        this.rect = r.merge(this.rect);

        // triangle (hole) group
        // NB: the function arg is crucial here! holes are known by id, not by index!
        this.triangle = this.triangle.data(this.holes, (d) => d.id);

        // update existing holes (selected visual states)
        this.triangle.selectAll('polyline')
            .style('fill', (d) => (d === this.selectedHole) ? d3.rgb('#808080').brighter().toString() : '#808080');

        // remove old holes
        this.triangle.exit().remove();

        // add new holes
        let h = this.triangle.enter().append('svg:g')
            .attr('transform', (d) => {
                return 'translate(' + (d.x-12) + ',' + (d.y-12) + ')';
            });

        h.append('svg:polyline')
            .attr('class', 'hole')
            .attr('points','0,24 12,0 24,24 0,24')
            .style('stroke', (d) => d3.rgb('#808080').darker().toString())
            .style('fill', (d) => (d === this.selectedHole) ? d3.rgb('#808080').brighter().toString() : '#808080')
            .on('mouseover', (d) => {
                d3.select(d3.event.currentTarget).attr('transform', 'scale(1.1)');
            })
            .on('mouseout', (d) => {
                d3.select(d3.event.currentTarget).attr('transform', '');
            })
            .on('mousedown', (d) => {
                if (d3.event.ctrlKey) return;

                // select hole
                this.mousedownHole = d;
                this.selectedHole = (this.mousedownHole === this.selectedHole) ? null : this.mousedownHole;
                this.selectedSegment = null;
                this.selectedVertex = null;
                this.selectedRegion = null;
                if (this.selectedHole) {
                    this.model.set('xy', [this.pxOfx.invert(this.selectedHole.x), this.pyOfy.invert(this.selectedHole.y)]);
                    this.touch();
                }

                this.restart();
            })
            .on('mouseup', (d) => {
                if (!this.mousedownHole) return;

                // check for drag-to-self
                this.mouseupHole = d;
                if (this.mouseupHole === this.mousedownHole) {
                    this.resetMouseVars();
                    return;
                }

                // unenlarge target hole
                d3.select(d3.event.currentTarget).attr('transform', '');

                // select new segment
                this.selectedSegment = null;
                this.selectedVertex = null;
                this.selectedRegion = null;
                this.selectedHole = null;

                this.restart();
            });

        this.triangle = h.merge(this.triangle);

        this.polygon = this.polygon.data(this.holes, (d) => d.id);
        this.polygon.selectAll('polygon');
        this.polygon.exit().remove();
        let hh = this.polygon.enter().append('svg:polygon')
            .attr('class', 'polygon')
            .style('fill', 'lime')
            .style('fill-opacity', '0.2');
        this.polygon = hh.merge(this.polygon);

        this.redraw();
    }

    update_backend() {
        this.model.set({
            vertices: this.vertices.map((d) => [this.pxOfx.invert(d.x), this.pyOfy.invert(d.y)]),
            vertexFlags: this.vertices.map((d) => d.type),
            segments: this.segments.map((d) => [this.vertices.indexOf(d.source), this.vertices.indexOf(d.target)]),
            segmentFlags: this.segments.map((d) => d.type),
            holes: this.holes.map((d) => [this.pxOfx.invert(d.x), this.pyOfy.invert(d.y)]),
            regions: this.regions.map((d) => [this.pxOfx.invert(d.x), this.pyOfy.invert(d.y)]),
            regionFlags: this.regions.map((d) => d.type)
        });
        this.touch();
    }

    python_changed() {
        // set up initial vertices and segments:
        // - vertices are known by 'id', not by index in array
        // - segments are always source < target

        let verticesList;
        let vertexFlagsList;
        d3.select(this.el).selectAll('#pslgid').remove();
        this.path = this.svg.append('svg:g').attr('id', 'pslgid').selectAll('path'); // segments
        this.circle = this.svg.append('svg:g').attr('id', 'pslgid').selectAll('g'); // vertices
        this.rect = this.svg.append('svg:g').attr('id', 'pslgid').selectAll('g_rect'); // regions
        this.triangle = this.svg.append('svg:g').attr('id', 'pslgid').selectAll('g_triangle'); // holes
        this.polygon = this.svg.append('svg:g').attr('id', 'pslgid').selectAll('g_polygon');
        verticesList = this.model.get('vertices');
        vertexFlagsList = this.model.get('vertexFlags');
        this.vertices = [];
        if (verticesList) {
            this.vertices = d3.range(0, verticesList.length).map((i) => {
                return {id: i,
                        x: this.pxOfx(verticesList[i][0]),
                        y: this.pyOfy(verticesList[i][1]),
                        type: vertexFlagsList[i],
                        is: 'vertex'
                       };
            });
        }
        this.lastVertexId = verticesList.length;

        let segmentsList;
        let segmentFlagsList;
        segmentsList = this.model.get('segments');
        segmentFlagsList = this.model.get('segmentFlags');
        this.segments = [];
        if (segmentsList) {
            this.segments = d3.range(0, segmentsList.length).map((i) => {
                return {source: this.vertices[segmentsList[i][0]],
                        target: this.vertices[segmentsList[i][1]],
                        type: segmentFlagsList[i],
                        is: 'segment'
                       };
            });
        }

        let regionsList;
        let regionFlagsList;
        regionsList = this.model.get('regions');
        regionFlagsList = this.model.get('regionFlags');
        this.regions = [];
        if (regionsList) {
            this.regions = d3.range(0, regionsList.length).map((i) => {
                return {id: i,
                        x: this.pxOfx(regionsList[i][0]),
                        y: this.pyOfy(regionsList[i][1]),
                        type: regionFlagsList[i],
                        is: 'region'
                       };
            });
        }
        this.lastRegionId = regionsList.length;

        let holesList;
        holesList = this.model.get('holes')
        this.holes = [];
        if (holesList) {
            this.holes = d3.range(0, holesList.length).map((i) => {
                return {id: i,
                        x: this.pxOfx(holesList[i][0]),
                        y: this.pyOfy(holesList[i][1]),
                        is: 'hole'
                       };
            });
        }
        this.lastHoleId = holesList.length;
    }

    resetMouseVars() {
        this.mousedownVertex = null;
        this.mousedownSegment = null;
        this.mousedownRegion = null;
        this.mousedownHole = null;
        this.mouseupVertex = null;
        this.mouseupRegion = null;
        this.mouseupHole = null;
    }

    position_changed() {
        let d;
        if (this.selectedVertex) {
            d = this.selectedVertex;
        }
        else if (this.selectedRegion) {
            d = this.selectedRegion;
        }
        else if (this.selectedHole) {
            d = this.selectedHole;
        }
        if (d) {
            let xy = this.model.get('xy')
            d.x = this.pxOfx(xy[0]);
            d.y = this.pyOfy(xy[1]);
            this.redraw();
            this.update_backend();
        }
    }

    redraw() {
        // draw directed edges with proper padding from node centers
        this.path.attr('d', (d) => {
            let deltaX = d.target.x - d.source.x;
            let deltaY = d.target.y - d.source.y;
            let dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            let normX = deltaX / dist;
            let normY = deltaY / dist;
            let sourcePadding = 12;
            let targetPadding = 12;
            let sourceX = d.source.x + (sourcePadding * normX);
            let sourceY = d.source.y + (sourcePadding * normY);
            let targetX = d.target.x - (targetPadding * normX);
            let targetY = d.target.y - (targetPadding * normY);

            return `M${sourceX},${sourceY}L${targetX},${targetY}`;
        });

        this.circle.attr('transform', (d) => `translate(${d.x},${d.y})`);
        this.rect.attr('transform', (d) => `translate(${d.x-12},${d.y-12})`);
        this.triangle.attr('transform', (d) => `translate(${d.x-12},${d.y-12})`);
    }

    mousedown() {
        return () => {
            // because :active only works in WebKit?
            this.svg.classed('active', true);

            if (d3.event.ctrlKey || this.mousedownVertex || this.mousedownSegment || this.mousedownRegion || this.mousedownHole) return;

            let point = d3.mouse(d3.event.currentTarget);

            if (this.add_new === 'region') {
                // new region
                let new_region = {id: ++this.lastRegionId, x: point[0], y: point[1], type: this.region_type, is: 'region'};
                this.regions.push(new_region);
                this.update_backend();
            }
            else if (this.add_new === 'hole') {
                // new hole
                let new_hole = {id: ++this.lastHoleId, x: point[0], y: point[1], is: 'hole'};
                this.holes.push(new_hole);
                this.update_backend();
            }
            else { // this.add_new === 'vertex'
                // new vertex
                let new_vertex = {id: ++this.lastVertexId, x: point[0], y: point[1], type: this.boundary_type, is: 'vertex'};
                this.vertices.push(new_vertex);
                this.update_backend();
            }

            this.restart();
        }
    }

    mousemove() {
        return () => {
            if (!this.mousedownVertex) return;

            let point = d3.mouse(d3.event.currentTarget);
            // update drag line
            this.dragLine
                .attr('d', `M${this.mousedownVertex.x},${this.mousedownVertex.y}L${point[0]},${point[1]}`);
        }
    }

    mouseup() {
        return () => {
            if (this.mousedownVertex) {
                // hide drag line
                this.dragLine
                    .classed('hidden', true);
            }

            // because :active only works in WebKit?
            this.svg.classed('active', false);

            this.resetMouseVars();
        }
    }

    spliceSegmentsForVertex(vertex) {
        const toSplice = this.segments.filter((l) => l.source === vertex || l.target === vertex);
        for (const l of toSplice) {
            this.segments.splice(this.segments.indexOf(l), 1);
        }
    }

    keydown() {
        return () => {
            d3.event.preventDefault();

            if (this.lastKeyDown !== -1) return;
            this.lastKeyDown = d3.event.keyCode;

            // ctrl
            if (d3.event.keyCode === 17) {
                this.circle.call(this.drag);
                this.rect.call(this.drag);
                this.triangle.call(this.drag);
                this.svg.classed('ctrl', true);
                return;
            }

            if (!this.selectedVertex && !this.selectedSegment && !this.selectedRegion && !this.selectedHole) return;

            // delete
            if (d3.event.keyCode === 46) {
                if (this.selectedVertex) {
                    this.vertices.splice(this.vertices.indexOf(this.selectedVertex), 1);
                    this.spliceSegmentsForVertex(this.selectedVertex);
                    this.update_backend();
                }
                else if (this.selectedSegment) {
                    this.segments.splice(this.segments.indexOf(this.selectedSegment), 1);
                    this.update_backend();
                }
                else if (this.selectedRegion) {
                    this.regions.splice(this.regions.indexOf(this.selectedRegion), 1);
                    this.update_backend();
                }
                else if (this.selectedHole) {
                    this.holes.splice(this.holes.indexOf(this.selectedHole), 1);
                    this.update_backend();
                }
                this.selectedSegment = null;
                this.selectedVertex = null;
                this.selectedRegion = null;
                this.selectedHole = null;
                this.restart();
            }
        }
    }

    keyup() {
        return () => {
            this.lastKeyDown = -1;
            if (d3.event.keyCode === 17) { // CTRL
                this.circle.on('.drag', null);
                this.rect.on('.drag', null);
                this.triangle.on('.drag', null);
                this.svg.classed('ctrl', false);
            }
        }
    }

    get_visibility(x, y) {
        let segment_coords = this.segments.map((d) => {
            let xy0 = [d.source.x, d.source.y];
            let xy1 = [d.target.x, d.target.y];
            return [xy0, xy1];
        });
        // add bounding box
        segment_coords.push([[0, 0], [0, this.height]]);
        segment_coords.push([[0, this.height], [this.width, this.height]]);
        segment_coords.push([[this.width, this.height], [this.width, 0]]);
        segment_coords.push([[this.width, 0], [0, 0]]);
        let polygon = this.visibilityPolygon.compute([x, y], segment_coords);
        this.polygon.attr('points', polygon);
    }

    add_new: any;
    boundary_type: any;
    circle: any;
    colors: any;
    drag: any;
    dragLine: any;
    height: any;
    holes: any;
    lastHoleId: any;
    lastKeyDown: any;
    lastRegionId: any;
    lastVertexId: any;
    mousedownHole: any;
    mousedownRegion: any;
    mousedownSegment: any;
    mousedownVertex: any;
    mouseupHole: any;
    mouseupRegion: any;
    mouseupVertex: any;
    path: any;
    polygon: any;
    pxOfx: any;
    pyOfy: any;
    rect: any;
    regions: any;
    region_type: any;
    segments: any;
    selectedHole: any;
    selectedRegion: any;
    selectedSegment: any;
    selectedVertex: any;
    svg: any;
    triangle: any;
    vertices: any;
    visibilityPolygon;
    width: any;
}
