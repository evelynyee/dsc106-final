function load(){
    let ety= "../data/test_english.csv"; // TODO: change to english.csv when done with development
    let countries="../data/List_of_official_languages_by_country_and_territory_1.csv"
    let map="../data/europe.geojson"
    process(ety, countries, map);
}

function process(ety, countries, map) {
    //preprocess data
    let rowConverter_ety = (d) => {return {
        word: d.term.trim().toLowerCase(),
        tag: ((d.group_tag.length > 0)? d.group_tag : d.parent_tag),
        lang: d.lang.trim().toLowerCase(),
        related_lang: d.related_lang.trim().toLowerCase(),
        related_word: d.related_term.trim().toLowerCase(),
        reltype: d.reltype.replace('_of','').replace('_from','').replace('_to','').replaceAll('_',' '),
        root: d.reltype.includes('root')
    }};
    d3.csv(ety, rowConverter_ety).then(function(ety){
        console.log(ety)
        render_plot1(ety);

        plot3(ety);

        const lang_types = [ 
            "Minority language",
            "National language",
            "Official language",
            "Regional language",
            "Widely spoken"]
        let rowConverter_count = (d) => {
            let langs = []
            lang_types.forEach(lang => {
                if (d[lang].length > 0) { // ignore blank values
                    splitted = (d[lang].includes('\n') ? d[lang].split('\n') : [d[lang]]) // split on newline characters
                    splitted.forEach(sub_lang => {
                        if (! langs.includes(sub_lang)) { // if the language isn't already in our list, add it. 
                            langs.push(sub_lang.split(' (')[0]) // ignore parenthetical comments
                        }
                    })
                }
            })
            return {
            country: d['Country/Region'],
            languages: langs
        }}
        d3.csv(countries, rowConverter_count).then(function(countries){
            console.log(countries)
            d3.json(map).then((map) => plot2(ety, countries, map));
        });
    });
}

// plot1 and plot2 share some data processing, so I split it out into its own function
function get_relcounts(data, reltypes) { 
    let rolled = d3.rollup(data, g=>g.length/1000, d=>d.related_lang, d=>d.reltype); // number of terms per language and relationship type
    let relcounts = [];
    rolled.forEach((innerMap, lang) => {
        if (lang.length > 0 && lang != 'English') {// ignore blank related_lang and ignore English relationships
            const inrow = Object.fromEntries(innerMap);
            outrow = {'lang':lang};
            if (reltypes) { // if a specific list of relationship types is passed, list all non-specified as 'other'
                other = 0;
                other_rels = []
                Object.keys(inrow).forEach((key) => {
                    if (reltypes.includes(key)) {outrow[key] = inrow[key];} 
                    else {
                        other = other+inrow[key];
                        other_rels.push(key)
                    }});
                Object.assign(outrow, {'other': other});
                Object.assign(outrow, {'other_rels': other_rels.sort()});}
            else {
                Object.assign(outrow, Object.fromEntries(innerMap))
            }
            Object.assign(outrow, {'total': d3.sum(Object.values(inrow))});
            relcounts.push(outrow);}
    });
    return relcounts
}

function render_plot1(data, bar_count=16) { // default number of bars is 8
    // dimensional constants
    const svgwidth = 800;
    const svgheight = 600;
    const margin = {top:50, bottom: 100, left: 100, right:160};
    const tooltip_width = 150;

    const font_family = "Comic Sans MS";
    const label_size = 16;
    const tick_size = label_size*0.7;
    const label_padding = 75; // padding between axis and axis labels
    const title_size = 20;
    const tick_rotate = -45;
    
    const legend_title_size = (title_size+label_size)/2;
    const legend_label_size = tick_size;
    const legend_rowheight = legend_label_size * 1.5;
    const legend_r = 3;
    const legend_border_width = 1;
    const scale_buffer = 0.1;

    // process data for plot
    const reltypes = ['inherited', 'borrowed', 'derived', 'cognate', 'other']; // focus on these four relationships only for clarity
    relcounts = get_relcounts(data.filter(d => d.related_lang != 'english'), reltypes);
    console.log(relcounts);
    relcounts = relcounts.sort((a,b)=> b.total-a.total).slice(0,bar_count); // only keep top bar_count languages
    console.log(relcounts);

    // I decided to not dynamically update the legend based on the data.
    // reltypes = new Set(); // for easy tracking of unique values
    // relcounts.forEach(row => Object.keys(row).forEach(reltype => reltypes.add(reltype))); // for each language, add the new relationship types to the set
    // reltypes.delete('lang');
    // reltypes.delete('total');
    // reltypes = Array.from(reltypes.values())

    // scales and axes
    let langs = relcounts.map(d=>d.lang);
    let xScale = d3.scaleBand()
        .domain(langs)
        .range([margin.left, svgwidth-margin.right])
        .padding(0.1);
    let xAxis = d3.axisBottom()
        .scale(xScale);
    
    let counts = relcounts.map(d => d.total);
    let max_count = d3.max(counts);
    let min_count = 0 // it makes the most sense to start the axis with 0 here, regardless of the data values.
    let count_buffer = scale_buffer*(max_count-min_count)
    let yScale = d3.scaleLinear()
        .domain([min_count, max_count+count_buffer])
        .range([svgheight-margin.bottom, margin.top]);
    let yAxis = d3.axisLeft().scale(yScale);

    let colorScale = (rel) => d3.interpolateSinebow(reltypes.indexOf(rel)/reltypes.length);

    // make svg canvas, bar_count button, tooltip
    const plot1 = d3.select("#plot1").html(''); // clear previous content
    svg = plot1.append('svg')
        .attr("height", svgheight)
        .attr("width", svgwidth)
        .style('display', 'block');
    const button_select = plot1.select('g.button')
    button = plot1.append('g')
            .attr('class', 'button')
            .style('position', 'relative')
            .style('display', 'block');
        button.append('label')
            .attr('for', 'p1bc')
            .html('# of Languages:')
            .style("font-family", font_family)
            .style("font-size", label_size);
        button.append('input')
            .attr('type', 'number')
            .attr('id', 'plot1_barcount')
            .attr('name', 'p1bc')
            .attr('value', bar_count)
            .attr('placeholder', 'default: 15')
            .style("font-family", font_family)
            .style("font-size", label_size);
        button.append('button')
            .html('Submit')
            .style("font-family", font_family)
            .style("font-size", label_size)
            .on('click', () => {
                console.log('new plot 1 bar count:', document.getElementById("plot1_barcount").value);
                render_plot1(data, document.getElementById("plot1_barcount").value) // when clicked, re-render chart
            });
    plot1.select("#tooltip1").remove() // remove old tooltip
    const tooltip = plot1.append('div')
        .attr('id', "tooltip1") // re-draw tooltip on top of everything
        .style("opacity", 0)
        .style("position", "absolute")
        .style('width', tooltip_width)
        .style("padding", legend_border_width)
        .style("background-color", d3.select('body').style('background-color'))
        .style("border", "1px solid black")
        .style("font-family", font_family)
        .style("font-size", tick_size)
        .style('text-transform', 'capitalize')
        .style('overflow-wrap', 'normal');

    // add axes, axes titles, chart title
    x_ax = svg.append("g").call(xAxis) // x axis
        .attr("class", "xAxis")
        .attr("transform", `translate(0,${svgheight-margin.bottom})`)
        .style("font-size", tick_size)
        .style("font-family", font_family)
        .style('text-transform', 'capitalize');
    x_ax.selectAll("text") // rotate x-axis tick labels
        .attr("transform", `rotate(${tick_rotate})`)
        .attr("dx", "-.6em") // shift the tick labels to lign back up with the axis
        .attr("dy", "-.2em")
        .style("text-anchor", "end");
    svg.append("g").call(yAxis) // y axis
        .attr("class", "yAxis")
        .attr("transform", `translate(${margin.left}, 0)`)
        .style("font-size", label_size-1)
        .style("font-family", font_family);
    svg.append("text") // x axis title
        .text("Origin Language")
        .attr("class", "xAxis")
        .attr("id", "xTitle")
        .attr("x", (margin.left+svgwidth-margin.right)/2) // center text
        .attr("y", svgheight - margin.bottom + label_padding)
        .attr("text-anchor", "middle")
        .style("font-size", label_size);
    svg.append("text") // y axis title
        .text("Number of English Words (Thousands)")
        .attr("class", "yAxis")
        .attr("id", "yTitle")
        .attr("x", margin.left - label_padding)
        .attr("y", (margin.top+svgheight-margin.bottom)/2)
        .attr("text-anchor", "middle")
        .attr("transform", `rotate(270, ${margin.left - label_padding}, ${(margin.top+svgheight-margin.bottom)/2})`) // make the y-Label vertical
        .style("font-size", label_size);
    svg.append("text") // chart title
        .text("Foreign Origins of English Words")
        .attr("id", "chartTitle")
        .attr("x", (margin.left+svgwidth-margin.right)/2) // center title over chart
        .attr("y", margin.top/2)
        .attr("text-anchor", "middle")
        .style("font-size", title_size);

    // add legend
    let legend_height = legend_rowheight/2; // track the total height of the legend, to draw border
    let legend = svg.append("g")
        .attr("class", "legend");
    legend.append("text")
        .text("Relationship Type")
        .attr("x", legend_border_width)
        .attr("y", legend_title_size) //between title and label size
        .style("font-size", legend_title_size);
    
    legend_height = legend_height + legend_title_size;
    let add_to_legend = (cat) => {
        // given a point, add the appropriate row to the legend
        row = legend.select(`.${cat}`);
        if (row.empty()) {  // only add new entries
            row = legend.append("g")
                .attr("class", `${cat}`)
                .attr("transform", `translate(${legend_border_width + legend_r}, ${legend_height})`);
            row.append("circle")
                .attr("cx", legend_border_width + legend_r)
                .attr("cy", legend_rowheight/2)
                .attr("r", legend_r)
                .style("fill", colorScale(cat));
            row.append("text")
                .text(cat)
                .attr("x", legend_border_width + 3*legend_r)
                .attr("y", legend_rowheight/1.5)
                .style("font-size", legend_label_size)
                .style('text-transform', 'capitalize');
            legend_height = legend_height + legend_rowheight;
        }
    }

    // add chart content
    stacked = d3.stack().keys(reltypes)(relcounts);
    console.log(stacked)

    svg.append("g")
        .attr('class', "bars")
        .selectAll("g")
            .data(stacked)
            .enter().append("g")
            .attr('class', d => d.key)
            .attr("fill", function (d) {return colorScale(d.key);})
            .each(d => add_to_legend(d.key))
            .selectAll("rect")
                .data(function (d) { return d;})
                .enter().append("rect")
                .attr("x", function (d) {return xScale(d.data.lang);})
                .attr("y", function (d) {return yScale(d[1]);})
                .attr("height", function (d) {return yScale(d[0]) - yScale(d[1]);})
                .attr("width", xScale.bandwidth())
                .on('mouseover', function (e,d) {
                    // highlighting
                    d3.select(this).style("stroke", "black").style("stroke-width", legend_border_width);
                    // tooltip
                    lang = d.data.lang;
                    tiptext = "Language: "+lang;
                    total = Math.round(d.data.total*1000).toLocaleString(); // convert back to # of words (instead of thousands)
                    tiptext = tiptext + "<br>Total words: "+total;
                    reltype = d3.select(this.parentNode).attr("class");
                    // tiptext = tiptext + "<br>Relationship Type: "+reltype
                    count = Math.round(d.data[reltype]*1000).toLocaleString();
                    tiptext = tiptext + "<br>"+reltype+" words: "+count;
                    if (reltype == "other") {
                        tiptext = tiptext + "<br>Included relationships:";
                        tooltip.append('p')
                            .html(tiptext);
                    tooltip.append('ul').selectAll('li')
                        .data(d.data.other_rels)
                        .enter().append('li')
                        .html(rel => rel);
                    }
                    else {
                        tooltip.html(tiptext);
                    }
                    tooltip.style("opacity", 1)
                        .style("left", (e.pageX + 10) + "px")
                        .style("top", (e.pageY - 10) + "px");
                })
                .on('mouseout', function (e,d) {
                    // highlighting
                    d3.select(this).style("stroke", "none");
                    // tooltip
                    tooltip.html('').style("opacity", 0).selectAll('ul').remove()
                });

    // vertically center legend, put border around legend
    legend.append("rect")
        .attr("id", "legendBorder")
        .attr("x",0)
        .attr("y",0)
        .attr("width", margin.right-legend_border_width-legend_r) // give space for border
        .attr("height", legend_height)
        .style("fill", "transparent")
        .style("stroke", "black")
        .style("stroke-width", legend_border_width);
    legend.attr("transform", `translate(${svgwidth-margin.right+legend_r}, ${(margin.top + svgheight - margin.bottom -legend_height)/2})`); // put legend on the right side of the chart, halfway down chart interior
}

function plot2(ety, countries, map) {
    console.log(map.features)
    
    // dimensional constants
    const svgwidth = 700;
    const svgheight = 600;
    const margin = {top:50, bottom: 50, left: 50, right:100};

    const font_family = "Comic Sans MS";
    const label_size = 10;
    const title_size = 20;

    const min_zoom = 0.5
    const max_zoom = 3
    const map_scale = 400;
    const color_min = "#feffb6";
    const color_max = "#0078ff";
    const border_color =  "gray";

    const legend_items = 5;
    const legend_title_size = (title_size+label_size)/2;
    const legend_rowheight = label_size * 1.5;
    const legend_border_width = 1;
    const legend_r = 6;

    // data processing
    relcounts = get_relcounts(ety);
    console.log(relcounts)
    // TODO: MATCH LANG TO COUNTRIES

    // scales, projections
    const min_count = 0; // TODO
    const max_count = 0; // TODO
    const colorScale = d3.scaleSequentialLog()
        .domain([min_count, max_count])
        .interpolator(d3.interpolateHcl(color_min, color_max));; //TODO
    
    const projection1 = d3.geoMercator()
        .center([12,57])
        .scale(map_scale)
        .translate([(margin.left+svgwidth-margin.right)/2, (margin.top+svgheight-margin.bottom)/2]);
    const pathgeo1 = d3.geoPath()
        .projection(projection1);
 
    // make svg canvas, tooltip
    svg = d3.select("#plot2").append("svg")
        .attr("height", svgheight)
        .attr("width", svgwidth)
        .style("font-family", font_family);
    
    tooltip = d3.select("#plot2").append("div")
        .attr("id", "tooltip2")
        .style("font-family", font_family)
        .style("font-size", label_size)
        .style("opacity", 0)
        .style("position", "absolute")
        .style("background-color", "white")
        .style("border", "1px solid black")
        .style("padding", legend_border_width);

    // draw map
    svg.selectAll("path")
        .data(map.features)
        .enter()
        .append("path")
        .attr('class', d => "mappath "+d.properties.NAME)
        .attr("d", pathgeo1)
        .attr('vector-effect',"non-scaling-stroke")
        .style("fill", 'rebeccapurple') //d => colorScale(rolled[stateSym[d.properties.name]]))
        .style('stroke', border_color)
        .style('stroke-width', legend_border_width)
        // .on('mouseover', function (e,d) {
        //     state = stateSym[d.properties.name];
        //     tiptext = "State: "+state;
        //     count = rolled[state];
        //     tiptext = tiptext + "<br>Total Sales: "+Math.round(count);
        //     tooltip.html(tiptext)
        //         .style("opacity", 1)
        //         .style("left", (e.pageX + 10) + "px")
        //         .style("top", (e.pageY - 10) + "px");
        // })
        // .on('mouseout', (e,d) => tooltip.style("opacity", 0));

    // map zoom
    let zoom = d3.zoom()
        .scaleExtent([min_zoom, max_zoom])
        .on('zoom', function(event) {
            d3.selectAll(".mappath").attr('transform', event.transform);
        }); 
    svg.call(zoom);

    // add chart title
    title = svg.append('g')
        .attr('class', 'charttitle');
    title.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('height', margin.top)
        .attr('width', margin.left+svgwidth)
        .style('fill', d3.select('body').style('background-color'));
    title.append("text")
        .text("English Vocabulary Influence by Country")
        .attr("id", "chartTitle")
        .attr("x", (margin.left+svgwidth-margin.right)/2) // center title over chart
        .attr("y", margin.top/2)
        .attr("text-anchor", "middle")
        .style("font-size", title_size);

    // add legend    
    let legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${svgwidth-margin.right+legend_r}, ${svgheight/2})`); // put legend on the right side of the chart, halfway down
    let legend_height = legend_rowheight/2; // track the total height of the legend, to draw border
    
    legend.append("text") // legend title
        .text("Number of English Words")
        .attr("x", 0)
        .attr("y", legend_title_size) //between title and label size
        .style("font-size", legend_title_size);
    legend_height = legend_height + legend_title_size;
    
    let add_to_legend = (value) => {
        // given a value, add the appropriate row to the legend
        row = legend.append("g")
            .attr("transform", `translate(${legend_r}, ${legend_height})`);
        row.append("circle")
            .attr("cx", legend_r/2)
            .attr("cy", label_size/2)
            .attr("r", legend_r)
            .style("fill", colorScale(value));
        row.append("text")
            .text('= $'+value.toLocaleString())
            .attr("x", 3*legend_r)
            .attr("y", label_size*0.75)
            .style("font-size", label_size);  
        legend_height = legend_height + legend_rowheight;
    }
    let legend_vals = Array(legend_items);
    let count_range = max_count - min_count;
    for (let i in [...legend_vals.keys()]) {
        legend_vals[i] = Math.round(min_count + count_range*(1/10)**i);
    }
    legend_vals.forEach(add_to_legend);

    legend.append("rect") // legend border
        .attr("id", "legendBorder")
        .attr("x",0)
        .attr("y",0)
        .attr("width", margin.right-legend_border_width-legend_r) // give space for border
        .attr("height", legend_height)
        .style("fill", "transparent")
        .style("stroke", "black")
        .style("stroke-width", legend_border_width);
}

function plot3(ety) {
    // TODO
}