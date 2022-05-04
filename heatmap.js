(function () {

  // Variables that will define the edges of the map and will 
  // serve as a basis for positioning the objects that will be created 
  var margin = { top: 50, right: 0, bottom: 0, left: 0 },
    width = 1100,
    height = 700 - margin.top - margin.bottom,
    formatNumber = d3.format(",d"),
    transitioning;

  // Creating svg tag and its layout and design values. And associate the tag 'g'
  var svg = d3.select("#heatmap").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.bottom + margin.top)
    .style("margin-left", -margin.left + "px")
    .style("margin.right", -margin.right + "px")
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
    .style("shape-rendering", "crispEdges");

  // Linear scale variable for width axis
  var x = d3.scale.linear()
    .domain([0, width])
    .range([0, width]);

  // Linear scale variable for height axis
  var y = d3.scale.linear()
    .domain([0, height])
    .range([0, height]);

  // Colors for the heat map
  const darkRed = "#990000";
  const red = "#d90000";
  const limitRed = "#ff2020";
  const green = "#75e560";
  const darkGreen = "#137C00";
  const n_1 = "#054d00";

  // Color mapping where you need to have 1 element more than the domain
  var color = d3.scale.threshold()
    .domain([-3, -0.25, 0.25, 3])
    .range([darkRed, red, limitRed, green, darkGreen, n_1]);

  // Create heat map layout by sorting in descending order 
  var treemap = d3.layout.treemap()
    .children(function (d, depth) { return depth ? null : d._children; })
    .sort(function (a, b) { return a.value - b.value; })
    .ratio(height / width * 0.5 * (1 + Math.sqrt(5)))
    .round(false);

  /* Create a variable and assign to it the svg variable with an additional 'g' 
    attribute with a 'class' node and value 'grandparent' */
  var grandparent = svg.append("g")
    .attr("class", "grandparent");

  // Adds a 'rect' child with attributes [ y , width , height ]
  grandparent.append("rect")
    .attr("y", -margin.top)
    .attr("width", width)
    .attr("height", margin.top);

  // Add a 'text' child with the attributes [ x , y , dy ]
  grandparent.append("text")
    .attr("x", 6)
    .attr("y", 6 - margin.top)
    .attr("dy", ".75em");

  /* Asynchronous reading of data.json, error checking with 
    exception and calling the logic and data methods and finally the display method */
  d3.queue()
    .defer(d3.json, "data.json")
    .await(function (error, root) {
      if (error) throw error;
      initialize(root);
      accumulate(root);
      layout(root);
      display(root);

      // Adds attributes to the root object which has the json data
      function initialize(root) {
        root.x = root.y = 0;
        root.dx = width;
        root.dy = height;
        root.depth = 0;
      }

      /* Recursive function that goes through each of the children of 'Mercado' 
      which is the parent array in the json and does the sum of the values */
      /* E.g.:  
        {
        "name": "Mercado", 
        "children": [
          "name": "TECNOLOGIA", 
          "children": [
            {
              "rate": -2.31, 
              "name": "LUAN1", 
              "value": 600.84
            }
             {
              "rate": 2.31, 
              "name": "LUAN2", 
              "value": 399.16
            }
          ]
          600.840 + 399.159 === 1000
          return 1000
          */
      function accumulate(d) {
        return (d._children = d.children)
          ? d.value = d.children.reduce(function (p, v) { return p + accumulate(v); }, 0)
          : d.value;
      }

      // Layout calculation using the attributes added together with the 'grandparent' variable
      function layout(d) {
        if (d._children) {
          treemap.nodes({ _children: d._children });
          d._children.forEach(function (c) {
            c.x = d.x + c.x * d.dx;
            c.y = d.y + c.y * d.dy;
            c.dx *= d.dx;
            c.dy *= d.dy;
            c.parent = d;
            layout(c);
          });
        }
      }

      // Function that adds styles and dynamic html code
      function display(d) {

        // Add click function to object
        grandparent
          .datum(d.parent)
          .on("click", transition)
          .select("text")
          .text(name(d));

        grandparent
          .datum(d.parent)
          .select("rect")
          .attr("fill", function () { return color(d['rate']) })

        // Create new object from 'grandparent' and add a class node with value 'depth'
        var g1 = svg.insert("g", ".grandparent")
          .datum(d)
          .attr("class", "depth");

        // Selects all children of data.json and associates the 'g' tag, created earlier
        var g = g1.selectAll("g")
          .data(d._children)
          .enter().append("g");

        // Filter that to enter next json node
        g.filter(function (d) { return d._children; })
          .classed("children", true)
          .on("click", transition);

        // Select all children of the node that arrived from the filter and associate 
        // the tag 'rect' add one more class attribute with value 'child'
        g.selectAll(".child")
          .data(function (d) { return d._children || [d]; })
          .enter().append("rect")
          .attr("class", "child")
          .call(rect);

        // Remove tooltip from heatmap div
        d3.select("#heatmap").select("#tooltip").remove();

        // Assigns a new div to div 'heatmap' an id attribute with tooltip value and css style
        d3.select("#heatmap").append("div")
          .attr("id", "tooltip")
          .style("opacity", 0);

        // Mounting the entire SVG with an empty href, and associating the tags created with that SVG
        // It also adds the tooltip with the detailed information of each area from the mouse position
        g.append("svg:a")
          .attr("xlink:href", function (d) {
            if (!d._children) {
              var url = "#";
              return url;
            }
          })
          .append("rect")
          .attr("class", "parent")
          .call(rect)
          .on("mouseover", function (d) {
            if (d.parent.name != "Mercado") {
              d3.select("#tooltip").transition()
                .duration(200)
                .style("opacity", 1);
              d3.select("#tooltip").html("<h3>" + d.name + "</h3><table>" +
                "<tr><td>" + d.value + "</td><td> (" + d.rate + "%)</td></tr>" +
                "</table>")
                .style("left", (d3.event.pageX - document.getElementById('heatmap').offsetLeft + 20) + "px")
                .style("top", (d3.event.pageY - document.getElementById('heatmap').offsetTop - 60) + "px");
            }
          })
          .on("mouseout", function (d) {
            d3.select("#tooltip").transition()
              .duration(500)
              .style("opacity", 0);
          })
          .append("title")
          .text(function (d) { return formatNumber(d.value); });

        // Put a title in the svg of each menu where there can be a focus
        g.append("text")
          .attr("dy", ".75em")
          .text(function (d) { return d.name; })
          .call(text);

        // Function that uses css and js to do a transition like zoom
        function transition(d) {
          if (transitioning || !d) return;
          transitioning = true;

          var g2 = display(d),
            t1 = g1.transition().duration(750),
            t2 = g2.transition().duration(750);

          x.domain([d.x, d.x + d.dx]);
          y.domain([d.y, d.y + d.dy]);

          svg.style("shape-rendering", null);

          svg.selectAll(".depth").sort(function (a, b) { return a.depth - b.depth; });

          g2.selectAll("text").style("fill-opacity", 0);

          t1.selectAll("text").call(text).style("fill-opacity", 0);
          t2.selectAll("text").call(text).style("fill-opacity", 1);
          t1.selectAll("rect").call(rect);
          t2.selectAll("rect").call(rect);

          t1.remove().each("end", function () {
            svg.style("shape-rendering", "crispEdges");
            transitioning = false;
          });
        }

        return g;
      }

      // Function that adds node name to block and centralizes it from the layout information of each data 
      function text(text) {
        text.attr("x", function (d) { return x(d.x) + (x(d.x + d.dx) - x(d.x)) / 2; })
          .attr("y", function (d) { return y(d.y) + (y(d.y + d.dy) - y(d.y)) / 2; })
          .attr("dy", 0)
          .attr("font-size", function (d) {
            var w = x(d.x + d.dx) - x(d.x),
              h = y(d.y + d.dy) - y(d.y),
              t = (d.name).length / 1.3;
            var tf = Math.min(Math.floor(w / t), h / 3);
            return (tf >= 5) ? Math.min(tf, 30) : 0;
          })
          .attr("fill", "white")
          .attr("text-anchor", "middle");
      }

      // Function that positions each rect tag and adds the colors of each space using the logic below:
      /*
        darkRed   => rate < -3
        red       => rate > -3    && rate < -0.25
        limitRed  => rate > -0.25 && rate < 0.25
        green     => rate >  0.25 && rate < 3
        darkGreen => rate >  3
      */
      function rect(rect) {
        rect.attr("x", function (d) { return x(d.x); })
          .attr("y", function (d) { return y(d.y); })
          .attr("width", function (d) { return x(d.x + d.dx) - x(d.x); })
          .attr("height", function (d) { return y(d.y + d.dy) - y(d.y); })
          .attr("fill", function (d) { return color(d.rate); });
      }

      // Function to put the svg title
      function name(d) {
        return d.parent
          ? "Setor : " + d.name + " (Voltar ao menu principal)"
          : "Menu Principal do " + d.name;
      }
    });
}());
