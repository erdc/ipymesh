export class VisibilityPolygon {

    compute (position, segments) {
        var bounded = [];
        var minX = position[0];
        var minY = position[1];
        var maxX = position[0];
        var maxY = position[1];
        for (var i = 0; i < segments.length; ++i) {
            for (var j = 0; j < 2; ++j) {
                minX = Math.min(minX, segments[i][j][0]);
                minY = Math.min(minY, segments[i][j][1]);
                maxX = Math.max(maxX, segments[i][j][0]);
                maxY = Math.max(maxY, segments[i][j][1]);
            }
            bounded.push([[segments[i][0][0], segments[i][0][1]], [segments[i][1][0], segments[i][1][1]]]);
        }
        --minX;
        --minY;
        ++maxX;
        ++maxY;
        bounded.push([[minX, minY],[maxX, minY]]);
        bounded.push([[maxX, minY],[maxX, maxY]]);
        bounded.push([[maxX, maxY],[minX, maxY]]);
        bounded.push([[minX, maxY],[minX, minY]]);
        var polygon = [];
        var sorted = this.sortPoints(position, bounded);
        var map = new Array(bounded.length);
        for (var i = 0; i < map.length; ++i) map[i] = -1;
        var heap = [];
        var start = [position[0] + 1, position[1]];
        for (var i = 0; i < bounded.length; ++i) {
            var a1 = this.angle(bounded[i][0], position);
            var a2 = this.angle(bounded[i][1], position);
            var active = false;
            if (a1 > -180 && a1 <= 0 && a2 <= 180 && a2 >= 0 && a2 - a1 > 180) active = true;
            if (a2 > -180 && a2 <= 0 && a1 <= 180 && a1 >= 0 && a1 - a2 > 180) active = true;
            if (active) {
                this.insert(i, heap, position, bounded, start, map);
            }
        }
        for (var i = 0; i < sorted.length;) {
            var extend = false;
            var shorten = false;
            var orig = i;
            var vertex = bounded[sorted[i][0]][sorted[i][1]];
            var old_segment = heap[0];
            do {
                if (map[sorted[i][0]] != -1) {
                    if (sorted[i][0] == old_segment) {
                        extend = true;
                        vertex = bounded[sorted[i][0]][sorted[i][1]];
                    }
                    this.remove(map[sorted[i][0]], heap, position, bounded, vertex, map);
                } else {
                    this.insert(sorted[i][0], heap, position, bounded, vertex, map);
                    if (heap[0] != old_segment) {
                        shorten = true;
                    }
                }
                ++i;
                if (i == sorted.length) break;
            } while (sorted[i][2] < sorted[orig][2] + this.epsilon());
    
            if (extend) {
                polygon.push(vertex);
                var cur = this.intersectLines(bounded[heap[0]][0], bounded[heap[0]][1], position, vertex);
                if (!this.equal(cur, vertex)) polygon.push(cur);
            } else if (shorten) {
                polygon.push(this.intersectLines(bounded[old_segment][0], bounded[old_segment][1], position, vertex));
                polygon.push(this.intersectLines(bounded[heap[0]][0], bounded[heap[0]][1], position, vertex));
            }
        }
        return polygon;
    };
    
    computeViewport (position, segments, viewportMinCorner, viewportMaxCorner) {
        var brokenSegments = [];
        var viewport = [[viewportMinCorner[0],viewportMinCorner[1]],[viewportMaxCorner[0],viewportMinCorner[1]],[viewportMaxCorner[0],viewportMaxCorner[1]],[viewportMinCorner[0],viewportMaxCorner[1]]];
        for (var i = 0; i < segments.length; ++i) {
            if (segments[i][0][0] < viewportMinCorner[0] && segments[i][1][0] < viewportMinCorner[0]) continue;
            if (segments[i][0][1] < viewportMinCorner[1] && segments[i][1][1] < viewportMinCorner[1]) continue;
            if (segments[i][0][0] > viewportMaxCorner[0] && segments[i][1][0] > viewportMaxCorner[0]) continue;
            if (segments[i][0][1] > viewportMaxCorner[1] && segments[i][1][1] > viewportMaxCorner[1]) continue;
            var intersections = [];
            for (var j = 0; j < viewport.length; ++j) {
                var k = j + 1;
                if (k == viewport.length) k = 0;
                if (this.doLineSegmentsIntersect(segments[i][0][0], segments[i][0][1], segments[i][1][0], segments[i][1][1], viewport[j][0], viewport[j][1], viewport[k][0], viewport[k][1])) {
                    var intersect = this.intersectLines(segments[i][0], segments[i][1], viewport[j], viewport[k]);
                    if (intersect.length != 2) continue;
                    if (this.equal(intersect, segments[i][0]) || this.equal(intersect, segments[i][1])) continue;
                    intersections.push(intersect);
                }
            }
            var start = [segments[i][0][0], segments[i][0][1]];
            while (intersections.length > 0) {
                var endIndex = 0;
                var endDis = this.distance(start, intersections[0]);
                for (var j = 1; j < intersections.length; ++j) {
                    var dis = this.distance(start, intersections[j]);
                    if (dis < endDis) {
                        endDis = dis;
                        endIndex = j;
                    }
                }
                brokenSegments.push([[start[0], start[1]], [intersections[endIndex][0], intersections[endIndex][1]]]);
                start[0] = intersections[endIndex][0];
                start[1] = intersections[endIndex][1];
                intersections.splice(endIndex, 1);
            }
            brokenSegments.push([start, [segments[i][1][0], segments[i][1][1]]]);
        }
    
        var viewportSegments = [];
        for (var i = 0; i < brokenSegments.length; ++i) {
            if (this.inViewport(brokenSegments[i][0], viewportMinCorner, viewportMaxCorner) && this.inViewport(brokenSegments[i][1], viewportMinCorner, viewportMaxCorner)) {
                viewportSegments.push([[brokenSegments[i][0][0], brokenSegments[i][0][1]], [brokenSegments[i][1][0], brokenSegments[i][1][1]]]);
            }
        }
        var eps = this.epsilon() * 10;
        viewportSegments.push([[viewportMinCorner[0]-eps,viewportMinCorner[1]-eps],[viewportMaxCorner[0]+eps,viewportMinCorner[1]-eps]]);
        viewportSegments.push([[viewportMaxCorner[0]+eps,viewportMinCorner[1]-eps],[viewportMaxCorner[0]+eps,viewportMaxCorner[1]+eps]]);
        viewportSegments.push([[viewportMaxCorner[0]+eps,viewportMaxCorner[1]+eps],[viewportMinCorner[0]-eps,viewportMaxCorner[1]+eps]]);
        viewportSegments.push([[viewportMinCorner[0]-eps,viewportMaxCorner[1]+eps],[viewportMinCorner[0]-eps,viewportMinCorner[1]-eps]]);
        return this.compute(position, viewportSegments);
    }
    
    inViewport (position, viewportMinCorner, viewportMaxCorner) {
        if (position[0] < viewportMinCorner[0] - this.epsilon()) return false;
        if (position[1] < viewportMinCorner[1] - this.epsilon()) return false;
        if (position[0] > viewportMaxCorner[0] + this.epsilon()) return false;
        if (position[1] > viewportMaxCorner[1] + this.epsilon()) return false;
        return true;
    }
    
    inPolygon (position, polygon) {
        var val = polygon[0][0];
        for (var i = 0; i < polygon.length; ++i) {
            val = Math.min(polygon[i][0], val);
            val = Math.min(polygon[i][1], val);
        }
        var edge = [val-1, val-1];
        var parity = 0;
        for (var i = 0; i < polygon.length; ++i) {
            var j = i + 1;
            if (j == polygon.length) j = 0;
            if (this.doLineSegmentsIntersect(edge[0], edge[1], position[0], position[1], polygon[i][0], polygon[i][1], polygon[j][0], polygon[j][1])) {
                var intersect = this.intersectLines(edge, position, polygon[i], polygon[j]);
                if (this.equal(position, intersect)) return true;
                if (this.equal(intersect, polygon[i])) {
                    if (this.angle2(position, edge, polygon[j]) < 180) ++parity;
                } else if (this.equal(intersect, polygon[j])) {
                    if (this.angle2(position, edge, polygon[i]) < 180) ++parity;
                } else {
                    ++parity;
                }
            }
        }
        return (parity%2)!=0;
    };
    
    convertToSegments (polygons) {
        var segments = [];
        for (var i = 0; i < polygons.length; ++i) {
            for (var j = 0; j < polygons[i].length; ++j) {
                var k = j+1;
                if (k == polygons[i].length) k = 0;
                segments.push([[polygons[i][j][0], polygons[i][j][1]], [polygons[i][k][0], polygons[i][k][1]]]);
            }
        }
        return segments;
    };
    
    breakIntersections (segments) {
        var output = [];
        for (var i = 0; i < segments.length; ++i) {
            var intersections = [];
            for (var j = 0; j < segments.length; ++j) {
                if (i == j) continue;
                if (this.doLineSegmentsIntersect(segments[i][0][0], segments[i][0][1], segments[i][1][0], segments[i][1][1], segments[j][0][0], segments[j][0][1], segments[j][1][0], segments[j][1][1])) {
                    var intersect = this.intersectLines(segments[i][0], segments[i][1], segments[j][0], segments[j][1]);
                    if (intersect.length != 2) continue;
                    if (this.equal(intersect, segments[i][0]) || this.equal(intersect, segments[i][1])) continue;
                    intersections.push(intersect);
                }
            }
            var start = [segments[i][0][0], segments[i][0][1]];
            while (intersections.length > 0) {
                var endIndex = 0;
                var endDis = this.distance(start, intersections[0]);
                for (var j = 1; j < intersections.length; ++j) {
                    var dis = this.distance(start, intersections[j]);
                    if (dis < endDis) {
                        endDis = dis;
                        endIndex = j;
                    }
                }
                output.push([[start[0], start[1]], [intersections[endIndex][0], intersections[endIndex][1]]]);
                start[0] = intersections[endIndex][0];
                start[1] = intersections[endIndex][1];
                intersections.splice(endIndex, 1);
            }
            output.push([start, [segments[i][1][0], segments[i][1][1]]]);
        }
        return output;
    };
    
    epsilon () {
        return 0.0000001;
    };
    
    equal (a, b) {
        if (Math.abs(a[0] - b[0]) < this.epsilon() && Math.abs(a[1] - b[1]) < this.epsilon()) return true;
        return false;
    };
    
    remove (index, heap, position, segments, destination, map) {
        map[heap[index]] = -1;
        if (index == heap.length - 1) {
            heap.pop();
            return;
        }
        heap[index] = heap.pop();
        map[heap[index]] = index;
        var cur = index;
        var parent = this.parent(cur);
        if (cur != 0 && this.lessThan(heap[cur], heap[parent], position, segments, destination)) {
            while (cur > 0) {
                var parent = this.parent(cur);
                if (!this.lessThan(heap[cur], heap[parent], position, segments, destination)) {
                    break;
                }
                map[heap[parent]] = cur;
                map[heap[cur]] = parent;
                var temp = heap[cur];
                heap[cur] = heap[parent];
                heap[parent] = temp;
                cur = parent;
            }
        } else {
            while (true) {
                var left = this.child(cur);
                var right = left + 1;
                if (left < heap.length && this.lessThan(heap[left], heap[cur], position, segments, destination) &&
                        (right == heap.length || this.lessThan(heap[left], heap[right], position, segments, destination))) {
                    map[heap[left]] = cur;
                    map[heap[cur]] = left;
                    var temp = heap[left];
                    heap[left] = heap[cur];
                    heap[cur] = temp;
                    cur = left;
                } else if (right < heap.length && this.lessThan(heap[right], heap[cur], position, segments, destination)) {
                    map[heap[right]] = cur;
                    map[heap[cur]] = right;
                    var temp = heap[right];
                    heap[right] = heap[cur];
                    heap[cur] = temp;
                    cur = right;
                } else break;
            }
        }
    };
    
    insert (index, heap, position, segments, destination, map) {
        var intersect = this.intersectLines(segments[index][0], segments[index][1], position, destination);
        if (intersect.length == 0) return;
        var cur = heap.length;
        heap.push(index);
        map[index] = cur;
        while (cur > 0) {
            var parent = this.parent(cur);
            if (!this.lessThan(heap[cur], heap[parent], position, segments, destination)) {
                break;
            }
            map[heap[parent]] = cur;
            map[heap[cur]] = parent;
            var temp = heap[cur];
            heap[cur] = heap[parent];
            heap[parent] = temp;
            cur = parent;
        }
    };
    
    lessThan (index1, index2, position, segments, destination) {
        var inter1 = this.intersectLines(segments[index1][0], segments[index1][1], position, destination);
        var inter2 = this.intersectLines(segments[index2][0], segments[index2][1], position, destination);
        if (!this.equal(inter1, inter2)) {
            var d1 = this.distance(inter1, position);
            var d2 = this.distance(inter2, position);
            return d1 < d2;
        }
        var end1 = 0;
        if (this.equal(inter1, segments[index1][0])) end1 = 1;
        var end2 = 0;
        if (this.equal(inter2, segments[index2][0])) end2 = 1;
        var a1 = this.angle2(segments[index1][end1], inter1, position);
        var a2 = this.angle2(segments[index2][end2], inter2, position);
        if (a1 < 180) {
            if (a2 > 180) return true;
            return a2 < a1;
        }
        return a1 < a2;
    };
    
    parent (index) {
        return Math.floor((index-1)/2);
    };
    
    child (index) {
        return 2*index+1;
    };
    
    angle2 (a, b, c) {
        var a1 = this.angle(a,b);
        var a2 = this.angle(b,c);
        var a3 = a1 - a2;
        if (a3 < 0) a3 += 360;
        if (a3 > 360) a3 -= 360;
        return a3;
    };
    
    sortPoints (position, segments) {
        var points = new Array(segments.length * 2);
        for (var i = 0; i < segments.length; ++i) {
            for (var j = 0; j < 2; ++j) {
                var a = this.angle(segments[i][j], position);
                points[2*i+j] = [i, j, a];
            }
        }
        points.sort(function(a,b) {return a[2]-b[2];});
        return points;
    };
    
    angle (a, b) {
        return Math.atan2(b[1]-a[1], b[0]-a[0]) * 180 / Math.PI;
    };
    
    intersectLines (a1, a2, b1, b2) {
        var dbx = b2[0] - b1[0];
        var dby = b2[1] - b1[1];
        var dax = a2[0] - a1[0];
        var day = a2[1] - a1[1];
    
        var u_b  = dby * dax - dbx * day;
        if (u_b != 0) {
            var ua = (dbx * (a1[1] - b1[1]) - dby * (a1[0] - b1[0])) / u_b;
            return [a1[0] - ua * -dax, a1[1] - ua * -day];
        }
        return [];
    };
    
    distance (a, b) {
        var dx = a[0]-b[0];
        var dy = a[1]-b[1];
        return dx*dx + dy*dy;
    };
    
    isOnSegment (xi, yi, xj, yj, xk, yk) {
      return (xi <= xk || xj <= xk) && (xk <= xi || xk <= xj) &&
             (yi <= yk || yj <= yk) && (yk <= yi || yk <= yj);
    };
    
    computeDirection (xi, yi, xj, yj, xk, yk) {
      let a = (xk - xi) * (yj - yi);
      let b = (xj - xi) * (yk - yi);
      return a < b ? -1 : a > b ? 1 : 0;
    };
    
    doLineSegmentsIntersect (x1, y1, x2, y2, x3, y3, x4, y4) {
      let d1 = this.computeDirection(x3, y3, x4, y4, x1, y1);
      let d2 = this.computeDirection(x3, y3, x4, y4, x2, y2);
      let d3 = this.computeDirection(x1, y1, x2, y2, x3, y3);
      let d4 = this.computeDirection(x1, y1, x2, y2, x4, y4);
      return (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
              ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) ||
             (d1 == 0 && this.isOnSegment(x3, y3, x4, y4, x1, y1)) ||
             (d2 == 0 && this.isOnSegment(x3, y3, x4, y4, x2, y2)) ||
             (d3 == 0 && this.isOnSegment(x1, y1, x2, y2, x3, y3)) ||
             (d4 == 0 && this.isOnSegment(x1, y1, x2, y2, x4, y4));
    };

}
