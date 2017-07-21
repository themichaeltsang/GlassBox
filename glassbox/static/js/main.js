(function() {
    var get_dimensions = function() {
        var width = $(window).width() / 5,
            height = $(window).height() / 5,
            margin = {
                top: 40,
                bottom: 40,
                left: 60,
                right: 20
            };

        return {
            margin: margin,
            width: width - margin.left - margin.right,
            height: height - margin.top - margin.bottom,
            xmin: margin.left,
            xmax: width + margin.left,
            ymin: margin.top,
            ymax: height + margin.top
        };
    };

    var Plot = Class.extend({
        init: function(selector, data, opts) {
            this.data = data;
            this.opts = opts;
            this.container = d3.select(selector);
        },

        append_svg: function(selector, dim) {
            return this.container.select(selector)
                    .append('svg')
                        .attr('width', dim.width + dim.margin.left + dim.margin.right)
                        .attr('height', dim.height + dim.margin.top + dim.margin.bottom)
                    .append('g')
                        .attr('transform',
                            'translate(' + dim.margin.left + ',' + dim.margin.top + ')');
        },

        add_axes: function(svg, dim) {
            var me = this;

            // Add the X Axis
            svg.append("g")
                .attr("class", "axis")
                .attr("transform", "translate(0," + dim.height + ")")
                .call(d3.axisBottom(me.scaleX));

            svg.append("text")
                .attr("class", "x label")
                .attr("text-anchor", "end")
                .attr("x", dim.width)
                .attr("y", dim.height + dim.margin.top - 6)
                .text(me.opts.labelX);

            // Add the Y Axis
            svg.append("g")
                .attr("class", "axis")
                .call(d3.axisLeft(me.scaleY));

            svg.append("text")
                .attr("class", "y label")
                .attr("text-anchor", "end")
                .attr("y", -dim.margin.left)
                .attr("dy", ".75em")
                .attr("transform", "rotate(-90)")
                .text(me.opts.labelY);
        }
    });

    var LinePlot = Plot.extend({
        render: function() {
            var dim = get_dimensions();
            var svg = this.append_svg('.viz-svg-container', dim);
            this.render_data(svg, dim);
            this.setup_drawing(svg, dim);
            this.setup_clear_drawing('.viz-container .btn-group', svg);
            this.setup_modify('.viz-container .btn-group', svg, dim);
            this.setup_closest_point(svg, dim);
        },

        render_data: function(svg, dim) {
            // based on https://bl.ocks.org/d3noob/ced1b9b18bd8192d2c898884033b5529
            var me = this;
            var data = this.data;

            // set the ranges
            // var x = d3.scaleTime().range([0, dim.width]);
            var x = d3.scaleLinear().range([0, dim.width]).clamp(true);
            var y = d3.scaleLinear().range([dim.height, 0]).clamp(true);

            this.interpolation = d3.curveCatmullRom;

            // set the colour scale
            var color = d3.scaleOrdinal(d3.schemeCategory10);

            // Scale the range of the data
            x.domain(d3.extent(data, function(d) { return d.x; }));
            y.domain(d3.extent(data, function(d) { return d.y; }));

            svg.append("text")
                    .attr("x", (dim.width / 2))
                    .attr("y", -dim.margin.top / 2)
                    .attr("text-anchor", "middle")
                    // .style("font-size", "16px")
                    // .style("text-decoration", "underline")
                    .text(this.opts.title);

            // Add the paths with different curves.
            me.path = svg.append("path")
                .datum(data)
                .attr("class", "line")
                .style("stroke", "black")
                .style("fill", "none")
                .attr("id", 'tag0') // assign ID
                .attr("d", d3.line()
                     .curve(me.interpolation)
                     .x(function(d) { return x(d.x); })
                     .y(function(d) { return y(d.y); })
                );

            me.scaleX = x;
            me.scaleY = y;

            // Add the scatterplot

            me.path.circles = svg.selectAll("circle.dot")
                .data(data);

            me.path.circles.exit().remove();

            me.path.circles
                .attr("class", "dot")
                .attr("r", 4)
                .attr("cx", function(d) { return x(d.x); })
                .attr("cy", function(d) { return y(d.y); });

            me.path.circles
                .enter()
                    .append("circle")
                        .attr("class", "dot")
                        .attr("r", 4)
                        .attr("cx", function(d) { return x(d.x); })
                        .attr("cy", function(d) { return y(d.y); });

            me.add_axes(svg, dim);
        },

        setup_drawing: function(svg, dim) {
            // based on https://bl.ocks.org/mbostock/f705fc55e6f26df29354
            // console.log('setup drawing');
            var me = this;
            var line = d3.line().curve(d3.curveCatmullRom);

            d3.select(svg.node().parentNode).call(
                  d3.drag()
                    .container(function() { return this; })
                    .subject(function() {
                        var p = [d3.event.x - dim.margin.left, d3.event.y - dim.margin.top];
                        return [p, p];
                    })
                    .on('start', function() { me.dragstarted(svg, dim, line); })
                    .on('end', function() { me.dragended(svg, dim, line); })
                );
        },

        dragstarted: function(svg, dim, line) {
            // console.log('drag started');

            var me = this;
            var d = d3.event.subject,
                active = svg.append('path').datum(d).attr('class', 'modified-line'),
                x0 = d3.event.x,
                y0 = d3.event.y;

            svg.active_drag = active;

            d3.event.on('drag', function() {
                var x1 = d3.event.x - dim.margin.left,
                    y1 = d3.event.y - dim.margin.top,
                    dx = x1 - x0,
                    dy = y1 - y0;

                if (dx * dx + dy * dy > 100) {
                    d.push([x0 = x1, y0 = y1]);
                } else {
                    d[d.length - 1] = [x1, y1];
                }

                active.attr('d', line);

                me.mousemoved(this, dim);
            });

            svg.select(".clear-sketch").attr('disabled', '');
        },

        dragended: function(svg, dim, line) {
            var d = d3.event.subject,
                active = svg.active_drag;

            d = simplify(d, 5, true);
            active.datum(d);
            active.attr('d', line);

            svg.active_drag = undefined;

        },

        setup_clear_drawing: function(selector, svg) {
            var me = this;
            return this.container.select(selector)
                    .append('button')
                        .attr('class', 'btn btn-default clear-sketch')
                        .text('Discard Sketch')
                        .on('click', function() {
                            me.clear_drawing(svg);
                        });
        },

        clear_drawing: function(svg) {
            this.container.selectAll('svg .modified-line').remove();
            this.tracker.line.style('stroke', 'none');
            this.tracker.circle.style('fill', 'none');
            svg.select(".clear-sketch").attr('disabled', 'disabled');
        },

        setup_modify: function(selector, svg, dim) {
            var me = this;
            return this.container.select(selector)
                    .append('button')
                        .attr('class', 'btn btn-primary')
                        .text('Update')
                        .on('click', function() {
                            me.modify_graph(svg, dim);
                        });
        },

        modify_graph: function(svg, dim) {
            var me = this;
            var data = me.path.datum();
            var modified_data = me.get_modified_data(svg, dim);
            // console.log(modified_data);

            data.forEach(function(d, i) {
                // if (me.tracker.data[d.x]) {
                //     // console.log('modified!');
                //     d.y = me.tracker.data[d.x][1];
                // }
                // console.log(d.x);

                if (modified_data[d.x]) {
                    d.y = modified_data[d.x].y;
                }
            });

            me.path.datum(data);

            me.path.attr("d", d3.line()
                     .curve(me.interpolation)
                     .x(function(d) { return me.scaleX(d.x); })
                     .y(function(d) { return me.scaleY(d.y); })
                );


            me.path.circles = svg.selectAll("circle.dot")
                .data(data)
                .attr("class", "dot")
                .attr("r", 4)
                .attr("cx", function(d) { return me.scaleX(d.x); })
                .attr("cy", function(d) { return me.scaleY(d.y); });

            me.path.circles.exit().remove();

            me.path.circles.enter()
                .append("circle")
                    .attr("class", "dot")
                    .attr("r", 4)
                    .attr("cx", function(d) { return me.scaleX(d.x); })
                    .attr("cy", function(d) { return me.scaleY(d.y); });
            // .merge(me.path.circles)
            //     .attr("cx", function(d) { return me.scaleX(d.x); })
            //     .attr("cy", function(d) { return me.scaleY(d.y); })

            // svg.selectAll('.modified-line').each(function(d, i) {
            //     console.log(this, d, i);
            // });

            me.clear_drawing(svg);

            this.changed = true;
        },

        get_modified_data: function(svg, dim) {
            var me = this;
            var x_values = $.map(this.data, function(d) {
                return me.scaleX(d.x);
            });

            var modified_data = {};
            var modified_lines = svg.selectAll('.modified-line');
            // modified_lines.each(function(m) { console.log(d3.select(this).node()) });

            var findYatXbyBisection = function(x, path, error){
                // based on https://stackoverflow.com/a/17896375
                var length_end = path.getTotalLength()
                    , length_start = 0
                    , point = path.getPointAtLength((length_end + length_start) / 2) // get the middle point
                    , bisection_iterations_max = 50
                    , bisection_iterations = 0

                error = error || 0.01

                while (x < point.x - error || x > point.x + error) {
                    // get the middle point
                    point = path.getPointAtLength((length_end + length_start) / 2)

                    if (x < point.x) {
                        length_end = (length_start + length_end)/2
                    } else {
                        length_start = (length_start + length_end)/2
                    }

                    // Increase iteration
                    if(bisection_iterations_max < ++ bisection_iterations)
                        break;
                }
                return point.y
            }

            for (var i=0, l=x_values.length; i < l; i++) {
                var x = x_values[i];
                modified_lines.each(function(m) {
                    if (x < m[0][0] || x > m[m.length - 1][0]) {
                        return;
                    } else {
                        // console.log(m[0][0], m[m.length - 1][0]);
                        // var point = me.closestPoint2(d3.select(this).node(), [x_values[i], 0], dim);
                        var point = findYatXbyBisection(x_values[i], d3.select(this).node());
                        // console.log(point);

                        var new_x = me.data[i].x,
                            new_y = me.scaleY.invert(point);

                        // console.log(new_x, me.data[i], new_y, point[1]);
                        modified_data[new_x] = { 'x': new_x, 'y': new_y };
                        return;
                        // console.log(point);
                    }

                });
            }

            return modified_data;

            // console.log(modified_data);

            // console.log(x_values);
        },

        setup_closest_point: function(svg, dim) {
            var me = this;

            var circle = svg.append('circle')
                            .style('fill', 'none')
                            .attr('cx', -10)
                            .attr('cy', -10)
                            .attr('r', 10);

            var line = svg.append('line').style('stroke', 'red');

            // d3.select(svg.node().parentNode).on('mousemove', function() { me.mousemoved(this, dim); });

            me.tracker = { 'circle': circle, 'line': line, 'data': {} };

        },

        mousemoved: function(event, dim) {
            // console.log('mouse moved');
            var m = d3.mouse(event);

            // var x0 = this.scaleX.invert(m[0]),
            var data = this.path.datum();

            // var i = this.path.bisector(data, x0, 1);
            // var d0 = data[i - 1],
            //     d1 = data[i];
            //
            // console.log(i, d0, d1);
            //
            // var d = x0 - d0.x > d1.x - x0 ? d1 : d0;
            // var p = [this.scaleX(d.x), this.scaleY(d.y)];

            var p = this.closestPoint(data, m, dim),
                pX = this.scaleX.invert(p[0]),
                mX = this.scaleX.invert(m[0]),
                mY = this.scaleY.invert(m[1] - dim.margin.top);

            if (p[0] === m[0]) {
                this.tracker.data[pX] = [mX, mY];
            } else if (this.tracker.data[p[0]] === undefined) {
                this.tracker.data[pX] = [mX, mY];
            }

            if (p[0] < (m[0] - dim.margin.left)) {
                this.tracker.line.attr('x1', p[0])
                    .attr('y1', p[1])
                    .attr('x2', m[0] - dim.margin.left)
                    .attr('y2', m[1] - dim.margin.top)
                    .style('stroke', 'red');

                this.tracker.circle.attr('cx', p[0]).attr('cy', p[1]).style('fill', 'red');
            }
            //  else {
            //     this.tracker.circle.style('fill', 'none');
            // }

        },

        closestPoint: function(datum, point, dim) {
            // based on https://bl.ocks.org/mbostock/8027637
            var me = this;
            var data_length = datum.length,
                precision = 8,
                best,
                bestLength,
                bestDistance = Infinity;

            // linear scan for coarse approximation
            for (var scan, scanLength = 0, scanDistance; scanLength < data_length; scanLength += precision) {
                if ((scanDistance = distanceX(scan = datum[scanLength])) < bestDistance) {
                    best = scan, bestLength = scanLength, bestDistance = scanDistance;
                }
            }

            // binary search for precise estimate
            precision = Math.floor(precision / 2);
            i = 0;
            while (precision > 0.5) {
                var before,
                        after,
                        beforeLength,
                        afterLength,
                        beforeDistance,
                        afterDistance;
                if ((beforeLength = bestLength - precision) >= 0 && (beforeDistance = distanceX(before = datum[beforeLength])) < bestDistance) {
                    best = before, bestLength = beforeLength, bestDistance = beforeDistance;
                } else if ((afterLength = bestLength + precision) <= data_length && (afterDistance = distanceX(after = datum[afterLength])) < bestDistance) {
                    best = after, bestLength = afterLength, bestDistance = afterDistance;
                } else {
                    precision /= 2;
                }
            }

            // best = [best.x, best.y];
            best = [me.scaleX(best.x), me.scaleY(best.y)];
            best.distance = Math.sqrt(bestDistance);
            // console.log(best);
            return best;

            function distanceX(p) {
                if (!p) {
                    return Infinity;
                }

                // console.log(p);
                var dx = me.scaleX(p.x) - point[0] + dim.margin.left;
                        // dy = me.scaleY(p.y) - point[1] + dim.margin.top;
                // return dx * dx + dy * dy;
                return dx * dx;
            }
        },

        closestPoint2: function(pathNode, point, dim) {
            // based on https://bl.ocks.org/mbostock/8027637
            var pathLength = pathNode.getTotalLength(),
                precision = 8,
                best,
                bestLength,
                bestDistance = Infinity;

            // linear scan for coarse approximation
            for (var scan, scanLength = 0, scanDistance; scanLength <= pathLength; scanLength += precision) {
                if ((scanDistance = distance2(scan = pathNode.getPointAtLength(scanLength))) < bestDistance) {
                    best = scan, bestLength = scanLength, bestDistance = scanDistance;
                }
            }

            // console.log(pathNode, point, scan, best);

            // binary search for precise estimate
            precision /= 2;
            i = 0;
            while (precision > 0.01) {
                var before,
                    after,
                    beforeLength,
                    afterLength,
                    beforeDistance,
                    afterDistance;

                if ((beforeLength = bestLength - precision) >= 0 && (beforeDistance = distance2(before = pathNode.getPointAtLength(beforeLength))) < bestDistance) {
                    best = before, bestLength = beforeLength, bestDistance = beforeDistance;
                } else if ((afterLength = bestLength + precision) <= pathLength && (afterDistance = distance2(after = pathNode.getPointAtLength(afterLength))) < bestDistance) {
                    best = after, bestLength = afterLength, bestDistance = afterDistance;
                } else {
                    precision /= 2;
                }
            }

            best = [best.x, best.y];
            best.distance = Math.sqrt(bestDistance);
            return best;

            function distance2(p) {
                var dx = p.x - point[0],
                    dy = p.y - point[1];
                // return dx * dx + dy * dy;
                return dx * dx;
            }
        },

        limit: function(val, min_val, max_val) {
            return Math.min(Math.max(val, min_val), max_val);
        },

        get_samples: function(num) {
            var pathNode = this.path.node(),
                pathLength = pathNode.getTotalLength(),
                increment = pathLength / (num - 1);

            // linear scan for coarse approximation
            var samples = [];
            for (var scan, scanLength = 0, scanDistance; scanLength <= pathLength; scanLength += increment) {
                var point = pathNode.getPointAtLength(scanLength),
                    x = this.scaleX.invert(point.x),
                    y = this.scaleY.invert(point.y);

                samples.push([x, y]);
                // console.log(x, y);
            }

            return samples;
        },
    });

    var HeatMap = Plot.extend({
        render: function() {
            var dim = get_dimensions();
            var svg = this.append_svg('.viz-svg-container', dim);
            this.render_data(svg, dim);
        },

        render_data: function(svg, dim) {
            // based on http://bl.ocks.org/tjdecke/5558084
            var me = this;

            // var x_elements = d3.set(me.data.map(function( d ) { return d[0]; } )).values(),
            //     y_elements = d3.set(me.data.map(function( d ) { return d[1]; } )).values();

            var array_data = [];
            var count = 0;
            for (var i=0, l=me.data.length; i < l; i++) {
                for (var j=0, m=me.data.length; j < m; j++) {
                    array_data[count] = [i, j, me.data[i][j]];
                    count += 1;
                }
            }

            console.log(array_data);

            var gridWidth = dim.width / me.data.length,
                gridHeight = dim.height / me.data.length,
                legendElementWidth = gridWidth * 2;

            console.log(gridWidth, gridHeight);

            var colors = ["#ffffd9","#edf8b1","#c7e9b4","#7fcdbb","#41b6c4","#1d91c0","#225ea8","#253494","#081d58"]; // alternatively colorbrewer.YlGnBu[9]


            var x = d3.scaleLinear()
                            .range([0, dim.width])
                            .domain([0, me.data.length]),
                y = d3.scaleLinear()
                            .range([dim.height, 0])
                            .domain([0, me.data.length]),
                c = d3.scaleQuantize()
                            .range(colors)
                            .domain(d3.extent(array_data, function(d) { return d[2]; }));

            // var x = d3.scaleBand()
            //                 .domain(x_elements)
            //                 .range([0, x_elements.length * gridSize]),
            //     y = d3.scaleBand()
            //                 .domain(y_elements)
            //                 .range([0, y_elements.length * gridSize])


            me.scaleX = x;
            me.scaleY = y
            me.scaleC = c;


           /******************************************************************************
            * Gooey Filter
            * Source: https://bl.ocks.org/nbremer/3da658e9a21cd3c71d0819f9698f3bfa
            */

           var defs = svg.append('defs');
           var filter = defs.append('filter').attr('id','gooeyCodeFilter');
           filter.append('feGaussianBlur')
             .attr('in','SourceGraphic')
             .attr('stdDeviation','3')
             //to fix safari: http://stackoverflow.com/questions/24295043/svg-gaussian-blur-in-safari-unexpectedly-lightens-image
             .attr('color-interpolation-filters','sRGB')
             .attr('result','blur');
           filter.append('feColorMatrix')
             .attr('in','blur')
             .attr('mode','matrix')
             .attr('values','1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9')
             .attr('result','gooey');

            svg.append("text")
                    .attr("x", (dim.width / 2))
                    .attr("y", -dim.margin.top / 2)
                    .attr("text-anchor", "middle")
                    // .style("font-size", "16px")
                    // .style("text-decoration", "underline")
                    .text(this.opts.title);

            var cell_group = svg.append('g').style('filter', 'url(#gooeyCodeFilter)');

            // Add the paths with different curves.
            me.cells = cell_group.selectAll('rect.cell')
                            .data(array_data)

            me.cells.exit().remove();

            me.cells.enter()
                    .append('rect')
                    .attr('class', 'cell')
                    .attr('width', gridWidth)
                    .attr('height', gridHeight)
                    .attr('x', function(d, i) { return me.scaleX(d[0]); })
                    .attr('y', function(d, i) { return me.scaleY(d[1]); })
                    .attr('fill', function(d, i) { return me.scaleC(d[2]); })
                    .attr('stroke', 'none');



            // start

            // set the ranges
            // var x = d3.scaleTime().range([0, dim.width]);
            // var x = d3.scaleLinear().range([0, dim.width]).clamp(true);
            // var y = d3.scaleLinear().range([dim.height, 0]).clamp(true);
            //
            // this.interpolation = d3.curveCatmullRom;
            //
            // // set the colour scale
            // var color = d3.scaleOrdinal(d3.schemeCategory10);

            // Scale the range of the data
            // x.domain(d3.extent(data, function(d) { return d.x; }));
            // y.domain(d3.extent(data, function(d) { return d.y; }));

            // Add the paths with different curves.
            // me.path = svg.append("path")
            //     .datum(data)
            //     .attr("class", "line")
            //     .style("stroke", "black")
            //     .style("fill", "none")
            //     .attr("id", 'tag0') // assign ID
            //     .attr("d", d3.line()
            //          .curve(me.interpolation)
            //          .x(function(d) { return x(d.x); })
            //          .y(function(d) { return y(d.y); })
            //     );

            // Add the scatterplot

            // me.path.circles = svg.selectAll("circle.dot")
            //     .data(data);
            //
            // me.path.circles.exit().remove();
            //
            // me.path.circles
            //     .attr("class", "dot")
            //     .attr("r", 4)
            //     .attr("cx", function(d) { return x(d.x); })
            //     .attr("cy", function(d) { return y(d.y); });
            //
            // me.path.circles
            //     .enter()
            //         .append("circle")
            //             .attr("class", "dot")
            //             .attr("r", 4)
            //             .attr("cx", function(d) { return x(d.x); })
            //             .attr("cy", function(d) { return y(d.y); });

            // end

            me.add_axes(svg, dim);

        }
    });

    window.glassbox = { 'plots': {} };

    var dataset = getParameterByName('dataset');
    // console.log(dataset);
    if (dataset) {
        d3.json('/data/' + dataset, function(error, data) {
            if (error) throw error;

            console.log(data);

            data.main_effects.forEach(function(d, i) {
                // console.log(d, i);
                var fixed_data = [];
                for (var i=0, l=d.plot.length; i<l; i++) {
                    fixed_data.push({
                        x: d.plot[i][0],
                        y: d.plot[i][1]
                    });
                }

                var id = d.name.toLowerCase().replace(' ', '-');
                $('.container-fluid .row').append("\
                    <div class='col-md-3 full-height' id='" + id + "'>\
                        <div class='middle viz-container'>\
                            <div class='viz-svg-container'></div>\
                            <div class='btn-group'></div>\
                        </div>\
                    </div>");

                glassbox.plots[id] = new LinePlot('#' + id, fixed_data, {'title': [d.name, data.outcome_variable].join(' vs '), labelX: d.name, labelY: data.outcome_variable});
                glassbox.plots[id].render();
                glassbox.plots[id].original_data = d;

                return false;
            });

            // console.log(data.interactions);
            data.interactions.forEach(function(d, i) {
                var id = d.names.join('--').toLowerCase().replace(' ', '-');
                $('.container-fluid .row').append("\
                    <div class='col-md-3 full-height' id='" + id + "'>\
                        <div class='middle viz-container'>\
                            <div class='viz-svg-container'></div>\
                            <div class='btn-group'></div>\
                        </div>\
                    </div>");

                glassbox.plots[id] = new HeatMap('#' + id, d.matrix,
                        {'title': [d.names[0], d.names[1], data.outcome_variable].join(' vs '),
                        labelX: d.names[0], labelY: d.names[1], labelZ: data.outcome_variable});
                glassbox.plots[id].render();
                glassbox.plots[id].original_data = d;
            });
        });
    }

    $('.evaluate').on('click', function() {
        $(this).addClass('btn-warning').prop('disabled', true);

        var changed_plots = {};
        Object.keys(glassbox.plots).forEach(function(key) {
            var plot = glassbox.plots[key];
            if (plot.changed) {
                var data = $.extend({}, plot.original_data);
                var samples = plot.get_samples(data.plot.length);
                data.plot = samples;
                changed_plots[key] = data;
            }
        });

        // console.log(changed_plots);

        $(this).removeClass('btn-warning').prop('disabled', false);
    });

    // d3.csv('/static/sample-data.csv', function(error, data) {
    //     if (error) throw error;
    //
    //     // parse the date / time
    //     var parseTime = d3.timeParse("%d-%b-%y");
    //
    //     var fixed_data = [];
    //     data.forEach(function(d) {
    //         d.date = parseTime(d.date);
    //         // d.close = +d.close;
    //         fixed_data.push({
    //             x: d.date,
    //             y: d.close
    //         });
    //     });
    //
    //     glassbox.graph1 = new LinePlot('#graph1', fixed_data);
    //     glassbox.graph1.render();
    //
    //     glassbox.graph2 = new LinePlot('#graph2', fixed_data);
    //     glassbox.graph2.render();
    // });

    function getParameterByName(name, url) {
        // from: https://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript
        if (!url) url = window.location.href;
        name = name.replace(/[\[\]]/g, "\\$&");
        var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
            results = regex.exec(url);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, " "));
    }
})();
