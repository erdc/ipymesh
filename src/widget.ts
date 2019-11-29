import * as widgets from '@jupyter-widgets/base';
import * as d3 from 'd3';

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
    }

    render () {
        super.render.apply(this, arguments);
        this.el.className = "jupyter-widget pslg_widget";
        //this.el.innerHTML = '';

        let that = this;
        let width = this.model.get('width');
        let height = this.model.get('height');
        let image = this.model.get('image');
        let Lx = this.model.get('Lx');
        let Ly = this.model.get('Ly');
        let x0 = this.model.get('x0');
        let y0 = this.model.get('y0');
        let boundary_type = this.model.get('boundary_type');
        let region_type = this.model.get('region_type');
        let add_new;
        let pxOfx = d3.scaleLinear()
            .domain([x0, Lx])
            .range([0, width]);
        let pyOfy = d3.scaleLinear()
            .domain([y0, Ly])
            .range([height, 0]);

        // set up SVG for D3
        const colors = d3.scaleOrdinal(d3.schemeCategory10);

        const svg = d3.select(this.el)
            .append('svg')
            .on('contextmenu', () => { d3.event.preventDefault(); })
            .attr('width', width)
            .attr('height', height)
            .attr("tabindex", 1); // can be focused on

        if (image.byteLength > 0) {
            //let blob = new Blob([this.model.get('value')], {type: `image/${this.model.get('format')}`});
            let blob = new Blob([image], {type: "image/png"});
            let url = URL.createObjectURL(blob);
            svg.append("defs")
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
            svg.append("rect")
            .attr("width", width)
            .attr("height", height)
            .attr("fill", "url(#bg)");
        }
        else {
            svg.append("rect")
            .attr("width", width)
            .attr("height", height)
            .attr("fill", "none");
        }

        // set up initial vertices and segments:
        // - vertices are known by 'id', not by index in array
        // - segments are always source < target

        let verticesList;
        let vertexFlagsList;
        let vertices;
        let lastVertexId;
        let segmentsList;
        let segmentFlagsList;
        let segments;
        let regionsList;
        let regionFlagsList;
        let regions;
        let lastRegionId;
        let holesList;
        let holes;
        let lastHoleId;
        let path; // segments
        let circle; // vertices
        let rect; // regions
        let triangle; // holes

        const python_changed = () => {
            d3.select(this.el).selectAll('#pslgid').remove();
            path = svg.append('svg:g').attr('id', 'pslgid').selectAll('path'); // segments
            circle = svg.append('svg:g').attr('id', 'pslgid').selectAll('g'); // vertices
            rect = svg.append('svg:g').attr('id', 'pslgid').selectAll('g_rect'); // regions
            triangle = svg.append('svg:g').attr('id', 'pslgid').selectAll('g_triangle'); // holes
            verticesList = this.model.get('vertices');
            vertexFlagsList = this.model.get('vertexFlags');
            vertices = [];
            if (verticesList) {
                vertices = d3.range(0, verticesList.length).map((i) => {
                    return {id: i,
                            x: pxOfx(verticesList[i][0]),
                            y: pyOfy(verticesList[i][1]),
                            type: vertexFlagsList[i],
                            is: 'vertex'
                           };
                });
            }
            lastVertexId = verticesList.length;

            segmentsList = this.model.get('segments');
            segmentFlagsList = this.model.get('segmentFlags');
            segments = [];
            if (segmentsList) {
                segments = d3.range(0, segmentsList.length).map((i) => {
                    return {source: vertices[segmentsList[i][0]],
                            target: vertices[segmentsList[i][1]],
                            type: segmentFlagsList[i],
                            is: 'segment'
                           };
                });
            }

            regionsList = this.model.get('regions');
            regionFlagsList = this.model.get('regionFlags');
            regions = [];
            if (regionsList) {
                regions = d3.range(0, regionsList.length).map((i) => {
                    return {id: i,
                            x: pxOfx(regionsList[i][0]),
                            y: pyOfy(regionsList[i][1]),
                            type: regionFlagsList[i],
                            is: 'region'
                           };
                });
            }
            lastRegionId = regionsList.length;

            holesList = this.model.get('holes')
            holes = [];
            if (holesList) {
                holes = d3.range(0, holesList.length).map((i) => {
                    return {id: i,
                            x: pxOfx(holesList[i][0]),
                            y: pyOfy(holesList[i][1]),
                            is: 'hole'
                           };
                });
            }
            lastHoleId = holesList.length;
        }
        python_changed();

        // mouse event vars
        let selectedVertex = null;
        let selectedRegion = null;
        let selectedHole = null;
        let selectedSegment = null;
        let mousedownVertex = null;
        let mousedownSegment = null;
        let mousedownRegion = null;
        let mousedownHole = null;
        let mouseupVertex = null;
        let mouseupRegion = null;
        let mouseupHole = null;

        // init D3 drag support
        const drag = d3.drag()
            // Mac Firefox doesn't distinguish between left/right click when Ctrl is held...
            .filter(() => d3.event.button === 0 || d3.event.button === 2)
            .on('start', (d) => {
                if (d.is === 'vertex') {
                    selectedVertex = d;
                    selectedRegion = null;
                    selectedHole = null;
                    selectedSegment = null;
                }
                else if (d.is === 'region') {
                    selectedVertex = null;
                    selectedRegion = d;
                    selectedHole = null;
                    selectedSegment = null;
                }
                else if (d.is === 'hole') {
                    selectedVertex = null;
                    selectedRegion = null;
                    selectedHole = d;
                    selectedSegment = null;
                }
                restart();
            })
            .on('drag', (d) => {
                d.x = d3.event.x;
                d.y = d3.event.y;
                redraw();
                that.model.set('xy', [pxOfx.invert(d.x), pyOfy.invert(d.y)]);
                that.touch();
            })
            .on('end', (d) => {
                update_backend();
            });

        // line displayed when dragging new nodes
        const dragLine = svg.append('svg:path')
          .attr('class', 'segment dragline hidden')
          .attr('d', 'M0,0L0,0');

        function resetMouseVars() {
            mousedownVertex = null;
            mousedownSegment = null;
            mousedownRegion = null;
            mousedownHole = null;
            mouseupVertex = null;
            mouseupRegion = null;
            mouseupHole = null;
        }

        // update layout
        function redraw() {
            // draw directed edges with proper padding from node centers
            path.attr('d', (d) => {
                const deltaX = d.target.x - d.source.x;
                const deltaY = d.target.y - d.source.y;
                const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                const normX = deltaX / dist;
                const normY = deltaY / dist;
                const sourcePadding = 12;
                const targetPadding = 12;
                const sourceX = d.source.x + (sourcePadding * normX);
                const sourceY = d.source.y + (sourcePadding * normY);
                const targetX = d.target.x - (targetPadding * normX);
                const targetY = d.target.y - (targetPadding * normY);

                return `M${sourceX},${sourceY}L${targetX},${targetY}`;
            });

            circle.attr('transform', (d) => `translate(${d.x},${d.y})`);
            rect.attr('transform', (d) => `translate(${d.x-12},${d.y-12})`);
            triangle.attr('transform', (d) => `translate(${d.x-12},${d.y-12})`);
        }

        // update graph (called when needed)
        function restart() {
            // path (segment) group
            path = path.data(segments);

            // update existing segments
            path.classed('selected', (d) => d === selectedSegment);

            // remove old segments
            path.exit().remove();

            // add new segments
            path = path.enter().append('svg:path')
                .attr('class', 'segment')
                .style('stroke', (d) => colors(d.type))
                .classed('selected', (d) => d === selectedSegment)
                .on('mousedown', (d) => {
                    if (d3.event.ctrlKey) return;

                    // select segment
                    mousedownSegment = d;
                    selectedSegment = (mousedownSegment === selectedSegment) ? null : mousedownSegment;
                    selectedVertex = null;
                    restart();
                })
                .merge(path);

            // circle (vertex) group
            // NB: the function arg is crucial here! vertices are known by id, not by index!
            circle = circle.data(vertices, (d) => d.id);

            // update existing vertices (selected visual states)
            circle.selectAll('circle')
                .style('fill', (d) => (d === selectedVertex) ? d3.rgb(colors(d.type)).brighter().toString() : colors(d.type));

            // remove old vertices
            circle.exit().remove();

            // add new vertices
            const g = circle.enter().append('svg:g')
                .attr('transform', (d) => {
                    return 'translate(' + d.x + ',' + d.y + ')';
                });

            g.append('svg:circle')
                .attr('class', 'vertex')
                .attr('r', 12)
                .style('fill', (d) => (d === selectedVertex) ? d3.rgb(colors(d.type)).brighter().toString() : colors(d.type))
                .style('stroke', (d) => d3.rgb(colors(d.type)).darker().toString())
                .on('mouseover', function (d) {
                    //if (!mousedownVertex || d === mousedownVertex) return;
                    // enlarge target vertex
                    d3.select(this).attr('transform', 'scale(1.1)');
                })
                .on('mouseout', function (d) {
                    //if (!mousedownVertex || d === mousedownVertex) return;
                    // unenlarge target vertex
                    d3.select(this).attr('transform', '');
                })
                .on('mousedown', (d) => {
                    if (d3.event.ctrlKey) return;

                    // select vertex
                    mousedownVertex = d;
                    selectedVertex = (mousedownVertex === selectedVertex) ? null : mousedownVertex;
                    selectedSegment = null;
                    selectedRegion = null;
                    selectedHole = null;
                    if (selectedVertex) {
                        that.model.set('xy', [pxOfx.invert(selectedVertex.x), pyOfy.invert(selectedVertex.y)]);
                        that.touch();
                    }

                    // reposition drag line
                    dragLine
                        //.style('marker-end', 'url(#end-arrow)')
                        .classed('hidden', false)
                        .attr('d', `M${mousedownVertex.x},${mousedownVertex.y}L${mousedownVertex.x},${mousedownVertex.y}`)
                        .style('stroke', (d) => colors(boundary_type));

                    restart();
                })
                .on('mouseup', function (d) {
                    if (!mousedownVertex) return;

                    // needed by FF
                    dragLine
                        .classed('hidden', true);
                        //.style('marker-end', '');

                    // check for drag-to-self
                    mouseupVertex = d;
                    if (mouseupVertex === mousedownVertex) {
                        resetMouseVars();
                        return;
                    }

                    // unenlarge target vertex
                    d3.select(this).attr('transform', '');

                    // add segment to graph (update if exists)
                    // NB: segments are strictly source < target
                    const isRight = mousedownVertex.id < mouseupVertex.id;
                    const source = isRight ? mousedownVertex : mouseupVertex;
                    const target = isRight ? mouseupVertex : mousedownVertex;

                    const segment = segments.filter((l) => l.source === source && l.target === target)[0];
                    if (!segment) {
                          segments.push({source: source, target: target, type: boundary_type, is: 'segment'});
                          update_backend();
                    }

                    // select new segment
                    selectedSegment = segment;
                    selectedVertex = null;
                    selectedRegion = null;
                    selectedHole = null;
                    restart();
                });

            // show vertex IDs
            g.append('svg:text')
                .attr('x', 0)
                .attr('y', 4)
                .attr('class', 'id')
                .text((d) => d.type);

            circle = g.merge(circle);

            // rect (region) group
            // NB: the function arg is crucial here! vertices are known by id, not by index!
            rect = rect.data(regions, (d) => d.id);

            // update existing regions (selected visual states)
            rect.selectAll('rect')
                .style('fill', (d) => (d === selectedRegion) ? d3.rgb(colors(d.type)).brighter().toString() : colors(d.type));

            // remove old regions
            rect.exit().remove();

            // add new regions
            const r = rect.enter().append('svg:g')
                .attr('transform', (d) => {
                    return 'translate(' + (d.x-12) + ',' + (d.y-12) + ')';
                });

            r.append('svg:rect')
                .attr('class', 'region')
                .attr('width', 24)
                .attr('height', 24)
                .style('fill', (d) => (d === selectedRegion) ? d3.rgb(colors(d.type)).brighter().toString() : colors(d.type))
                .style('stroke', (d) => d3.rgb(colors(d.type)).darker().toString())
                .on('mouseover', function (d) {
                    d3.select(this).attr('transform', 'scale(1.1)');
                })
                .on('mouseout', function (d) {
                    d3.select(this).attr('transform', '');
                })
                .on('mousedown', (d) => {
                    if (d3.event.ctrlKey) return;

                    // select vertex
                    mousedownRegion = d;
                    selectedRegion = (mousedownRegion === selectedRegion) ? null : mousedownRegion;
                    selectedSegment = null;
                    selectedVertex = null;
                    selectedHole = null;
                    if (selectedRegion) {
                        that.model.set('xy', [pxOfx.invert(selectedRegion.x), pyOfy.invert(selectedRegion.y)]);
                        that.touch();
                    }

                    restart();
                })
                .on('mouseup', function (d) {
                    if (!mousedownRegion) return;

                    // check for drag-to-self
                    mouseupRegion = d;
                    if (mouseupRegion === mousedownRegion) {
                        resetMouseVars();
                        return;
                    }

                    // unenlarge target vertex
                    d3.select(this).attr('transform', '');

                    // select new segment
                    selectedSegment = null;
                    selectedVertex = null;
                    selectedRegion = null;
                    selectedHole = null;

                    restart();
                });

            // show vertex IDs
            r.append('svg:text')
                .attr('x', 12)
                .attr('y', 16)
                .attr('class', 'id')
                .text((d) => d.type);

            rect = r.merge(rect);

            // triangle (hole) group
            // NB: the function arg is crucial here! holes are known by id, not by index!
            triangle = triangle.data(holes, (d) => d.id);

            // update existing holes (selected visual states)
            triangle.selectAll('polyline')
                .style('fill', (d) => (d === selectedHole) ? d3.rgb('#808080').brighter().toString() : '#808080');

            // remove old holes
            triangle.exit().remove();

            // add new holes
            const h = triangle.enter().append('svg:g')
                .attr('transform', (d) => {
                    return 'translate(' + (d.x-12) + ',' + (d.y-12) + ')';
                });

            h.append('svg:polyline')
                .attr('class', 'hole')
                .attr('points','0,24 12,0 24,24 0,24')
                .style('stroke', (d) => d3.rgb('#808080').darker().toString())
                .style('fill', (d) => (d === selectedHole) ? d3.rgb('#808080').brighter().toString() : '#808080')
                .on('mouseover', function (d) {
                    d3.select(this).attr('transform', 'scale(1.1)');
                })
                .on('mouseout', function (d) {
                    d3.select(this).attr('transform', '');
                })
                .on('mousedown', (d) => {
                    if (d3.event.ctrlKey) return;

                    // select hole
                    mousedownHole = d;
                    selectedHole = (mousedownHole === selectedHole) ? null : mousedownHole;
                    selectedSegment = null;
                    selectedVertex = null;
                    selectedRegion = null;
                    if (selectedHole) {
                        that.model.set('xy', [pxOfx.invert(selectedHole.x), pyOfy.invert(selectedHole.y)]);
                        that.touch();
                    }

                    restart();
                })
                .on('mouseup', function (d) {
                    if (!mousedownHole) return;

                    // check for drag-to-self
                    mouseupHole = d;
                    if (mouseupHole === mousedownHole) {
                        resetMouseVars();
                        return;
                    }

                    // unenlarge target hole
                    d3.select(this).attr('transform', '');

                    // select new segment
                    selectedSegment = null;
                    selectedVertex = null;
                    selectedRegion = null;
                    selectedHole = null;

                    restart();
                });

            triangle = h.merge(triangle);

            redraw();
        }

        // only respond once per keydown
        let lastKeyDown = -1;

        function mousedown() {
            // because :active only works in WebKit?
            svg.classed('active', true);

            if (d3.event.ctrlKey || mousedownVertex || mousedownSegment || mousedownRegion || mousedownHole) return;

            let point = d3.mouse(this);

            if (add_new === 'region') {
                // new region
                let new_region = {id: ++lastRegionId, x: point[0], y: point[1], type: region_type, is: 'region'};
                regions.push(new_region);
                update_backend();
            }
            else if (add_new === 'hole') {
                // new hole
                let new_hole = {id: ++lastHoleId, x: point[0], y: point[1], is: 'hole'};
                holes.push(new_hole);
                update_backend();
            }
            else { // add_new === 'Vertex'
                // new vertex
                let new_vertex = {id: ++lastVertexId, x: point[0], y: point[1], type: boundary_type, is: 'vertex'};
                vertices.push(new_vertex);
                update_backend();
            }

          restart();
        }

        function mousemove() {
            if (!mousedownVertex) return;

            // update drag line
            dragLine
                .attr('d', `M${mousedownVertex.x},${mousedownVertex.y}L${d3.mouse(this)[0]},${d3.mouse(this)[1]}`);
        }

        function mouseup() {
            if (mousedownVertex) {
                // hide drag line
                dragLine
                    .classed('hidden', true);
                    //.style('marker-end', '');
            }

            // because :active only works in WebKit?
            svg.classed('active', false);

            // clear mouse event vars
            resetMouseVars();
        }

        function spliceSegmentsForVertex(vertex) {
            const toSplice = segments.filter((l) => l.source === vertex || l.target === vertex);
            for (const l of toSplice) {
                segments.splice(segments.indexOf(l), 1);
            }
        }

        function keydown() {
            d3.event.preventDefault();

            if (lastKeyDown !== -1) return;
            lastKeyDown = d3.event.keyCode;

            // ctrl
            if (d3.event.keyCode === 17) {
                circle.call(drag);
                rect.call(drag);
                triangle.call(drag);
                svg.classed('ctrl', true);
                return;
            }

            if (!selectedVertex && !selectedSegment && !selectedRegion && !selectedHole) return;

            // delete
            if (d3.event.keyCode === 46) {
                if (selectedVertex) {
                    vertices.splice(vertices.indexOf(selectedVertex), 1);
                    spliceSegmentsForVertex(selectedVertex);
                    update_backend();
                }
                else if (selectedSegment) {
                    segments.splice(segments.indexOf(selectedSegment), 1);
                    update_backend();
                }
                else if (selectedRegion) {
                    regions.splice(regions.indexOf(selectedRegion), 1);
                    update_backend();
                }
                else if (selectedHole) {
                    holes.splice(holes.indexOf(selectedHole), 1);
                    update_backend();
                }
                selectedSegment = null;
                selectedVertex = null;
                selectedRegion = null;
                selectedHole = null;
                restart();
            }
        }

        function keyup() {
            lastKeyDown = -1;

            // ctrl
            if (d3.event.keyCode === 17) {
                circle.on('.drag', null);
                rect.on('.drag', null);
                triangle.on('.drag', null);
                svg.classed('ctrl', false);
            }
        }

        const position_changed = () => {
            let d;
            if (selectedVertex) {
                d = selectedVertex;
            }
            else if (selectedRegion) {
                d = selectedRegion;
            }
            else if (selectedHole) {
                d = selectedHole;
            }
            if (d) {
                let xy = this.model.get('xy')
                d.x = pxOfx(xy[0]);
                d.y = pyOfy(xy[1]);
                redraw();
                //that.model.set('x', pxOfx.invert(d.x));
                //that.model.set('y', pyOfy.invert(d.y));
                //that.touch();
                update_backend();
            }
        }

        // app starts here
        svg.on('mousedown', mousedown)
            .on('mousemove', mousemove)
            .on('mouseup', mouseup);
        d3.select(this.el)
            .on('keydown', keydown)
            .on('keyup', keyup);
        restart();

        this.model.on('change:boundary_type', () => {boundary_type = this.model.get("boundary_type");}, this);
        this.model.on('change:region_type', () => {region_type = this.model.get("region_type");}, this);
        this.model.on('change:add_new', () => {add_new = this.model.get("add_new");}, this);
        this.model.on('change:_sync_toggle', () => {python_changed(); restart();}, this);
        this.model.on('change:xy', () => {position_changed();}, this);

        const update_backend = () => {
            this.model.set({
                vertices: vertices.map((d) => [pxOfx.invert(d.x), pyOfy.invert(d.y)]),
                vertexFlags: vertices.map((d) => d.type),
                segments: segments.map((d) => [vertices.indexOf(d.source), vertices.indexOf(d.target)]),
                segmentFlags: segments.map((d) => d.type),
                holes: holes.map((d) => [pxOfx.invert(d.x), pyOfy.invert(d.y)]),
                regions: regions.map((d) => [pxOfx.invert(d.x), pyOfy.invert(d.y)]),
                regionFlags: regions.map((d) => d.type)
            });
            this.touch();
        }
    }
}
