import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

Promise.all([
    d3.csv("FemAct.csv"),
    d3.csv("FemTemp.csv"),
    d3.csv("MaleAct.csv"),
    d3.csv("MaleTemp.csv")
]).then(function([femAct, femTemp, maleAct, maleTemp]) {
    const femaleMice = ["Overall", ...Object.keys(femAct[0])];  
    const maleMice = ["Overall", ...Object.keys(maleAct[0])];

    let currentFilter = "all";  // 'all', 'day', or 'night'
    let highlightEstrus = false; // Estrus highlight toggle

    // Populate dropdowns
    d3.select("#femaleMouseSelect")
      .selectAll("option")
      .data(femaleMice)
      .enter()
      .append("option")
      .text(d => d)
      .attr("value", d => d);

    d3.select("#maleMouseSelect")
      .selectAll("option")
      .data(maleMice)
      .enter()
      .append("option")
      .text(d => d)
      .attr("value", d => d);

    function getDataForMouse(mouseID, dataset) {
        let data = Array.from({ length: 14 * 8 }, (_, i) => ({
            Time: i / 8,
            Day: Math.floor(i / 8),
            IsDay: (i % 8) < 4,
            IsEstrus: Math.floor(i / 8) % 4 === 1, // Estrus occurs on day 2, 6, 10, 14
            Value: mouseID === "Overall"
                ? d3.mean(dataset.slice(i * 180, (i + 1) * 180), row => 
                    d3.mean(Object.values(row).map(Number))
                  )
                : d3.mean(dataset.slice(i * 180, (i + 1) * 180), d => +d[mouseID])
        }));

        if (currentFilter === "day") {
            return data.filter(d => d.IsDay);
        } else if (currentFilter === "night") {
            return data.filter(d => !d.IsDay);
        }
        return data;
    }

    function updateChart(femaleMouse, maleMouse, dataType) {
        function calculateVariance(femData, maleData) {
            let ssd = d3.sum(femData.map((d, i) => Math.pow(d.Value - maleData[i].Value, 2)));
        
            // Update variance display
            d3.select("#varianceDisplay").text(`Variance (SSD): ${ssd.toFixed(2)}`);
        }
        
        const femDataset = dataType === "Activity" ? femAct : femTemp;
        const maleDataset = dataType === "Activity" ? maleAct : maleTemp;

        const femData = getDataForMouse(femaleMouse, femDataset);
        const maleData = getDataForMouse(maleMouse, maleDataset); calculateVariance(femData, maleData);


        const svg = d3.select("svg"),
              margin = {top: 40, right: 100, bottom: 50, left: 100},
              width = +svg.attr("width") - margin.left - margin.right,
              height = +svg.attr("height") - margin.top - margin.bottom;

        svg.selectAll("*").remove();

        const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scaleLinear().domain([0, 14]).range([0, width]);
        const yScale = d3.scaleLinear().domain([
            d3.min([...femData, ...maleData], d => d.Value),
            d3.max([...femData, ...maleData], d => d.Value)
        ]).range([height, 0]);

        g.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).ticks(14));
        g.append("g").call(d3.axisLeft(yScale).tickFormat(d3.format(".1f")));

        // Highlight estrus days (if enabled)
        if (highlightEstrus) {
            g.selectAll(".estrus-zone")
              .data(femData.filter(d => d.IsEstrus))
              .enter()
              .append("rect")
              .attr("x", d => x(d.Day))
              .attr("width", width / 14)
              .attr("y", 0)
              .attr("height", height)
              .attr("fill", "rgba(255, 182, 193, 0.3)"); // Light pink background for estrus days
        }

        const lineFem = d3.line().x(d => x(d.Time)).y(d => yScale(d.Value));
        const lineMale = d3.line().x(d => x(d.Time)).y(d => yScale(d.Value));

        g.append("path").datum(femData)
         .attr("fill", "none")
         .attr("stroke", highlightEstrus ? "purple" : "blue")  // Purple for estrus, otherwise blue
         .attr("stroke-width", highlightEstrus ? 3 : 2)  // Thicker if estrus is on
         .attr("d", lineFem);

        g.append("path").datum(maleData)
         .attr("fill", "none")
         .attr("stroke", "red")
         .attr("stroke-width", 2)
         .attr("d", lineMale);
        // X-axis label
        g.append("text")
.attr("x", width / 2)
.attr("y", height + 40)
.attr("text-anchor", "middle")
.style("font-size", "14px")
.text("Time of Measurement (Days)");
// Y-axis label
g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -60)
    .attr("text-anchor", "middle")
    .style("font-size", "14px")
    .text(dataType === "Activity" ? "Activity Level" : "Core Body Temperature (°C)");




        // Tooltip
        const tooltip = d3.select("body").append("div")
            .attr("id", "tooltip")
            .style("position", "absolute")
            .style("visibility", "hidden")
            .style("background", "lightgray")
            .style("padding", "5px")
            .style("border-radius", "5px");

        svg.on("mousemove", function(event) {
            const mouseX = d3.pointer(event, this)[0] - margin.left;
            const time = x.invert(mouseX);

            const closestFem = femData.reduce((prev, curr) =>
                Math.abs(curr.Time - time) < Math.abs(prev.Time - time) ? curr : prev);
            const closestMale = maleData.reduce((prev, curr) =>
                Math.abs(curr.Time - time) < Math.abs(prev.Time - time) ? curr : prev);

            tooltip.style("visibility", "visible")
                .html(`Day: ${closestFem.Day}<br>
                       Period: ${closestFem.IsDay ? 'Day' : 'Night'}<br>
                       Estrus: ${closestFem.IsEstrus ? 'Yes' : 'No'}<br>
                       Female (${femaleMouse}) ${dataType}: ${closestFem.Value.toFixed(2)}<br>
                       Male (${maleMouse}) ${dataType}: ${closestMale.Value.toFixed(2)}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 30) + "px");
        }).on("mouseleave", () => tooltip.style("visibility", "hidden"));
    }

    function onDropdownChange() {
        const femaleMouse = d3.select("#femaleMouseSelect").property("value");
        const maleMouse = d3.select("#maleMouseSelect").property("value");
        const dataType = d3.select("#dataTypeSelect").property("value");
        updateChart(femaleMouse, maleMouse, dataType);
    }

    function toggleDayNight() {
        if (currentFilter === "all") {
            currentFilter = "day";
            d3.select("#dayNightToggle").text("Show: Day");
        } else if (currentFilter === "day") {
            currentFilter = "night";
            d3.select("#dayNightToggle").text("Show: Night");
        } else {
            currentFilter = "all";
            d3.select("#dayNightToggle").text("Show: All");
        }
        onDropdownChange();
    }

    function toggleEstrus() {
        highlightEstrus = !highlightEstrus;
        d3.select("#estrusToggle").text(highlightEstrus ? "Estrus Highlight: ON" : "Estrus Highlight: OFF");
        onDropdownChange();
    }

    d3.select("#femaleMouseSelect").on("change", onDropdownChange);
    d3.select("#maleMouseSelect").on("change", onDropdownChange);
    d3.select("#dataTypeSelect").on("change", onDropdownChange);
    d3.select("#dayNightToggle").on("click", toggleDayNight);
    d3.select("#estrusToggle").on("click", toggleEstrus);

    updateChart(femaleMice[0], maleMice[0], "Activity");
});

