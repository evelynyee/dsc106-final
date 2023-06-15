// TODO: plot 3 legend: link style to relationship type
// TODO: more interaction for plot2? (e.g. filter links by value (count) or by relationship types)

function load(){
    let ety= "../data/test_english.csv"; // filtered etymoloy data to only engish terms
    // let countries="../data/List_of_official_languages_by_country_and_territory_1.csv"
    let map="../data/europe.geojson"
    let net="../data/lang_links.json" // I created this node-link dataset from the full etymology csv (all languages) using python (pandas)
    process(ety, map, net);
}

function process(ety, map, net) {
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
        // console.log(ety);
        render_plot1(ety.filter(d=> d.lang=='english'));

        words = extract_words(ety);
        render_plot3(words, document.getElementById("term_input").value);
    });

    d3.json(map).then((map) => {
        d3.json(net).then((net) => plot2(net, map));
    });
}

function render_plot1(data, bar_count=16) { // default number of bars is 8
    // dimensional constants
    const svgwidth = 800;
    const svgheight = 600;
    const margin = {top:50, bottom: 100, left: 100, right:160};
    const tooltip_width = 150;
    const page = d3.select('body').style('background-color') // global constant

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
    const border_width = 1;
    const scale_buffer = 0.1;

    // process data for plot
    const reltypes = ['inherited', 'borrowed', 'derived', 'cognate', 'other']; // focus on these four relationships only for clarity
    let rolled = d3.rollup(data, g=>g.length/1000, d=>d.related_lang, d=>d.reltype); // number of related terms (in thousands) per language and relationship type
    let relcounts = [];
    rolled.forEach((innerMap, lang) => {
        if (lang.length > 0 && lang != 'english') {// ignore blank related_lang and ignore English relationships
            const inrow = Object.fromEntries(innerMap);
            outrow = {'lang':lang};
            other = 0;
            other_rels = []
            Object.keys(inrow).forEach((key) => {
                if (reltypes.includes(key)) {outrow[key] = inrow[key];} 
                else {
                    other = other+inrow[key];
                    other_rels.push(key)
                }});
            Object.assign(outrow, {'other': other});
            Object.assign(outrow, {'other_rels': other_rels.sort()});
            Object.assign(outrow, {'total': d3.sum(Object.values(inrow))});
            relcounts.push(outrow);
    }});
    // console.log(relcounts);
    relcounts = relcounts.sort((a,b)=> b.total-a.total).slice(0,bar_count); // only keep top bar_count languages
    // console.log(relcounts);

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
    const svg = plot1.append('svg')
        .attr("height", svgheight)
        .attr("width", svgwidth)
        .style('display', 'block');
    const button = plot1.append('g')
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
    const tooltip = plot1.append('div')
        .attr('id', "tooltip1") // re-draw tooltip on top of everything
        .style("opacity", 0)
        .style("position", "absolute")
        .style('width', tooltip_width)
        .style("padding", border_width)
        .style("background-color", page)
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
        .attr("x", (margin.right-border_width-legend_r)/2)
        .attr("y", legend_title_size) //between title and label size
        .style("font-size", legend_title_size)
        .style('text-anchor', 'middle');
    
    legend_height = legend_height + legend_title_size;
    let add_to_legend = (cat) => {
        // given a point, add the appropriate row to the legend
        row = legend.select(`.${cat}`);
        if (row.empty()) {  // only add new entries
            row = legend.append("g")
                .attr("class", `${cat}`)
                .attr("transform", `translate(${border_width + legend_r}, ${legend_height})`);
            row.append("circle")
                .attr("cx", border_width + legend_r)
                .attr("cy", legend_rowheight/2)
                .attr("r", legend_r)
                .style("fill", colorScale(cat));
            row.append("text")
                .text(cat)
                .attr("x", border_width + 3*legend_r)
                .attr("y", legend_rowheight/1.5)
                .style("font-size", legend_label_size)
                .style('text-transform', 'capitalize');
            legend_height = legend_height + legend_rowheight;
        }
    }

    // add chart content
    stacked = d3.stack().keys(reltypes)(relcounts);

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
                    d3.select(this).style("stroke", "black").style("stroke-width", border_width);
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
        .attr('class', 'border')
        .attr("id", "legendBorder1")
        .attr("x",0)
        .attr("y",0)
        .attr("width", margin.right-border_width-legend_r) // give space for border
        .attr("height", legend_height)
        .style("fill", "transparent")
        .style("stroke", "black")
        .style("stroke-width", border_width);
    legend.attr("transform", `translate(${svgwidth-margin.right+legend_r}, ${(margin.top + svgheight - margin.bottom -legend_height)/2})`); // put legend on the right side of the chart, halfway down chart interior
}

function plot2(net, euromap) {
    // dimensional constants
    const svgwidth = 800;
    const svgheight = 600;
    const margin = {top:50, bottom: 50, left: 50, right:200};
    const page = d3.select('body').style('background-color');

    const font_family = "Comic Sans MS";
    const label_size = 10;
    const title_size = 20;

    const min_zoom = 0.5;
    const max_zoom = 3;
    const map_scale = 400;
    const map_fill = '#d2edcc';
    const map_background = '#dceaff'
    const border_width = 1;
    const border_color =  "gray";

    const r = 3;
    const link_width = 3;
    const node_color = 'black'

    const legend_title_size = (title_size+label_size)/2;
    const legend_label_size = label_size;
    const legend_rowheight = legend_label_size * 1.5;
    const legend_r = 4;
    const legend_items = 5;

    // scales, projections
    values = net.links.map(d => d.value);
    min_val = d3.min(values)
    max_val = d3.max(values)

    const color_min = d3.interpolatePurples(0)
    const color_max = d3.interpolatePurples(1)
    const colorScale = d3.scaleSequentialLog()
        .domain([min_val,max_val])
        .interpolator(d3.interpolateHsl(color_min, color_max));
    
    const projection = d3.geoMercator()
        .center([12,57])
        .scale(map_scale)
        .translate([(margin.left+svgwidth-margin.right)/2, (margin.top+svgheight-margin.bottom)/2-20]); // manually adjusted to put the map centered-ish
    const pathgeo1 = d3.geoPath()
        .projection(projection);
 
    // make svg canvas, tooltip
    svg = d3.select("#plot2").append("svg")
        .attr("height", svgheight)
        .attr("width", svgwidth)
        .style("font-family", font_family)
        .style('background-color', map_background);
    
    tooltip = d3.select("#plot2").append("div")
        .attr("id", "tooltip2")
        .style("font-family", font_family)
        .style("font-size", label_size)
        .style('visibility', 'hidden')
        .style("position", "absolute")
        .style('text-transform', 'capitalize')
        .style("background-color", page)
        .style("border", "1px solid black")
        .style("padding", border_width);

    // draw map background, map
    svg.selectAll("path")
        .data(euromap.features)
        .enter()
        .append("path")
        .attr('class', d => "mappath "+d.properties.FIPS)
        .attr("d", pathgeo1)
        .attr('vector-effect',"non-scaling-stroke")
        .html(function() {
            area = this.getBBox();
            return [area.x+(area.width/2),area.y+(area.height/2)];})
        .style("fill", map_fill) //d => colorScale(rolled[stateSym[d.properties.name]]))
        .style('stroke', border_color)
        .style('stroke-width', border_width);

    function get_position(lang) {// get the x,y-coordinates associated with the center of the country associated with the language
        let country = net.lang_to_country[lang];
        let area = svg.select('path.'+country);
        //document.getElementsByClassName(country)[0].getBoundingClientRect();
        let x = parseFloat(area.html().split(',')[0]);
        let y = parseFloat(area.html().split(',')[1]);
        return [x,y]
    }
    
    // add links
    let link = svg.selectAll("line")
        .data(net.links)
        .enter()
        .append("line")
        .attr('class', d => 'link '+net.nodes[d.source].name+' '+net.nodes[d.target].name)
        .attr('x1', d => get_position(net.nodes[d.source].name)[0])
        .attr('y1', d => get_position(net.nodes[d.source].name)[1])
        .attr('x2', d => get_position(net.nodes[d.target].name)[0])
        .attr('y2', d => get_position(net.nodes[d.target].name)[1])
        .attr("stroke", d => colorScale(d.value))
        .attr('vector-effect',"non-scaling-stroke")
        .style("stroke-width", link_width) //d => widthScale(d.value))
        .style('opacity', 0);

    // add nodes
    let node = svg.selectAll("circle")
        .data(net.nodes)
        .enter()
        .append("circle")
        .attr('class', 'node')
        .attr('cx', d=> {
            pos = get_position(d.name)[0];
            country = net.lang_to_country[d.name]
            if (country == 'NO'){return pos - 60;} // manual tweaks for a couple of countries to move the node closer to the middle
            else if (country == 'IT') {return pos - 10;}
            else if (country == 'DA') {return pos - 15;}
            else {return pos;}})
        .attr('cy', d=> {
            pos = get_position(d.name)[1];
            country = net.lang_to_country[d.name]
            if (country == 'NO'){return pos + 60;}
            else if (country == 'IT') {return pos - 20;}
            else if (country == 'HR') {return pos - 10;}
            else {return pos;}})
        .attr('r', r)
        .style("fill", node_color)
        .html('false')
        .on('mouseover', function (e,d) { // hover for tooltip
            tiptext = 'Language: '+d.name;
            fips = net.lang_to_country[d.name];
            country = euromap.features.filter(d => (d.properties.FIPS == fips))[0];
            country = country.properties.NAME;
            tiptext = tiptext+'<br>Country: '+country;
            tooltip.html(tiptext)
                .style('visibility', 'visible')
                .style("left", (e.pageX + 10) + "px")
                .style("top", (e.pageY - 10) + "px");
        })
        .on('mouseout', function () { // done hovering - hide tooltip
            tooltip.style('visibility', 'hidden');
            })
        .on('click', function (e,d) { // click to toggle links to this country on/off
            let clicked = this.html;
            if (clicked == 'true') { // already active - hide links to this country
                svg.selectAll('line.'+d.name)
                .style('opacity', 0);
                this.html = 'false';  // mark as inactive
            }
            else { // inactive - show links to this country
                svg.selectAll('line.'+d.name)
                    .style('opacity', 1);
                this.html = 'true'; // mark as active
            }
        });

    // zoom
    let zoom = d3.zoom()
        .scaleExtent([min_zoom, max_zoom])
        // .translateExtent([[-475,-400],[450,350]])
        .on('zoom', function(event) {
            node.attr('transform', event.transform);
            link.attr('transform', event.transform);
            d3.selectAll(".mappath").attr('transform', event.transform);
        }); 
    svg.call(zoom);

    // cover up zoom overflow into padding and add border around map-able part of svg
    const max_margin = d3.max(Object.values(margin));
    let zoombox = svg.append('g')
        .attr('class', 'zoombox')
    zoombox.append('rect')
        .attr('x',margin.left-max_margin/2) // account for half of stroke to be inside the shape
        .attr('y', margin.top-max_margin/2)
        .attr('height', svgheight-margin.top-margin.bottom+max_margin)
        .attr('width', svgwidth-margin.left-margin.right+max_margin)
        .style('fill', 'none')
        .style('stroke', page)
        .style('stroke-width', max_margin);
    zoombox.append('rect')
        .attr('class', 'border')
        .attr('x',margin.left)
        .attr('y', margin.top)
        .attr('height', svgheight-margin.top-margin.bottom)
        .attr('width', svgwidth-margin.left-margin.right)
        .style('fill', 'none')
        .style('stroke', 'black')
        .style('stroke-width', border_width);


    // add chart title
    title = svg.append("text")
        .text("Etymological Relationships in European Languages")
        .attr("id", "chartTitle")
        .attr("x", (margin.left+svgwidth-margin.right)/2) // center title over chart
        .attr("y", margin.top/2)
        .attr("text-anchor", "middle")
        .style("font-size", title_size);

    // add legend    
    let legend = svg.append("g")
        .attr("class", "legend");
    let legend_height = legend_rowheight/2; // track the total height of the legend, to draw border
    
    legend_border = legend.append("rect") // put border around legend
        .attr('class', 'border')
        .attr("id", "legendBorder2")
        .attr("x",0)
        .attr("y",0)
        .attr("width", margin.right-border_width-legend_r) // give space for border
        .attr("height", legend_height)
        .style("fill", page)
        .style("stroke", "black")
        .style("stroke-width", border_width);
    
    legend.append("text") // legend title
        .text("Number of Related Words")
        .attr("x", (margin.right-border_width-legend_r)/2)
        .attr("y", legend_title_size) //between title and label size
        .style("font-size", legend_title_size)
        .style('text-anchor', 'middle');
    legend_height = legend_height + legend_title_size;
    
    let add_to_legend = (value) => {
        // given a value, add the appropriate row to the legend
        row = legend.append("g")
            .attr("transform", `translate(${border_width + legend_r}, ${legend_height})`);
        row.append("circle")
            .attr("cx", border_width + legend_r)
            .attr("cy", label_size/2)
            .attr("r", legend_r)
            .style("fill", colorScale(value));
        row.append("text")
            .text('= '+value.toLocaleString())
            .attr("x", border_width + 3*legend_r)
            .attr("y", label_size*0.75)
            .style("font-size", label_size);  
        legend_height = legend_height + legend_rowheight;
    }
    let legend_vals = Array(legend_items);
    let val_range = max_val - min_val;
    for (let i in [...legend_vals.keys()]) {
        legend_vals[i] = Math.round(min_val + val_range*(1/10)**i);
    }
    legend_vals.forEach(add_to_legend);

    // vertically center legend
    legend_border.attr('height', legend_height);
    legend.attr("transform", `translate(${svgwidth-margin.right+legend_r}, ${(margin.top + svgheight - margin.bottom -legend_height)/2})`); // put legend on the right side of the chart, halfway down chart interior
}

function extract_words(data) { // data processing for plot 3
    rolled = d3.rollup(data, g => g.map(rel=> {
        return {
        word:rel.related_word, 
        lang:rel.related_lang.replaceAll(' ', '_'), 
        reltype:rel.reltype};})
        .filter(rel => rel.word.length > 0), d=>d.word);

    words = {};
    rolled.forEach((inner, word) => {
        words[word] = Array.from(inner);
    })
    return words;
}

function render_plot3(data, term='word', exclude_langs=[]) {
    // dimensional constants
    const svgwidth = 600;
    const svgheight = 600;
    const margin = {top:50, bottom: 50, left: 20, right:150};
    const page = d3.select('body').style('background-color');
    
    const font_family = "Comic Sans MS";
    const label_size = 14;
    const title_size = 20;

    const border_width = 1;
    const border_color =  "gray";
    const plot_background = '#f6fbff'
    const error_color = 'firebrick'

    const link_color = "black";
    const link_width = 3;
    const term_color = border_color;
    const r = 20;
    const node_stroke_width = r/4;

    const label_weight = 500
    const label_color = 'black';
    const label_outline = plot_background;
    const label_outline_width = '0.0em'

    const legend_title_size = (title_size+label_size)/2;
    const legend_label_size = label_size;
    const legend_rowheight = legend_label_size * 1.7;

    // setup language input box
    const plot3 = d3.select("#plot3");
    plot3.selectAll('.term_in')
        .style('font-family', font_family)
        .style('font-size', label_size)
    plot3.select('#termBtn')
        .on('click', () => { // term search button
        console.log('new plot 3 search term:', document.getElementById("term_input").value);
        render_plot3(data, document.getElementById("term_input").value); // when clicked, re-render chart
    }); 

    // data processing - select target term and make node-link data
    const reltypes = ['inherited', 'borrowed', 'derived', 'cognate', 'other']; // using the same set of relationships from plot1
    const rels = data[term];
    const langs = (typeof rels == 'undefined'? [] : Array.from(new Set(rels.map(d=>d.lang))).sort()); // empty array if term not in dataset
    const words = (typeof rels == 'undefined'? [] : Array.from(new Set(rels.filter(d=>! exclude_langs.includes(d.lang)).map(d=>d.word+' '+d.lang)))); // dont include nodes/links for excluded (un-checked) languages

    const nodes = [{id:0, name:term, lang:'term', reltypes:[]}];
    const links = [];
    words.forEach((word_lang, i) => {
        const word = word_lang.split(' ')[0];
        const lang = word_lang.split(' ')[1];
        const word_reltypes = [];
        let word_rels = rels.filter(rel => (rel.word == word) && (rel.lang == lang));
        word_rels.forEach((rel) => {
            if (! word_reltypes.includes(rel.reltype)){ // don't add repeat relationships
                word_reltypes.push(rel.reltype);
                links.push({source:0, target:i+1, value:(reltypes.includes(rel.reltype)? rel.reltype : 'other')})
        }});
        nodes.push({id:i+1, name:word, lang:lang, reltypes:word_reltypes});
    });

    // scales
    const dashes = ['7 3','','1','3','2 2 5 7'] // possible values for stroke-dasharray
    const dashScale = d3.scaleOrdinal().domain(reltypes).range(dashes)
    const colorScale = (lang) => d3.interpolateSinebow(langs.indexOf(lang)/langs.length);

    // make language checkboxes
    let lang_buttons = plot3.select('#plot3Langs')
        .style('font-size', label_size)
        .style('background-color', plot_background);  
    lang_buttons.selectAll('div').remove() // remove old language checkboxes
    lang_buttons.selectAll('div') // language checkboxes
        .data(langs).enter()
        .append('div')
        .style('position', 'relative')
        .style('left', '0')
        .attr('class', lang => 'langbox '+lang)
        .style('margin', label_size/2) // space between check items
        .append('input')
        .attr('type', 'checkbox')
        .attr('id', lang => 'check_'+lang)
        .attr('name', lang => lang)
        .property('checked', lang => (exclude_langs.includes(lang)? null : true)) // un-check excluded languages
        .on('click', function (e,d) {
            const box = d3.select('#'+'check_'+d);
            if (box.property('checked')) {
                // console.log('checkbox: '+d+' checked.');
                render_plot3(data, term, exclude_langs.filter(lang => lang != d)); // re-draw plot removing lang from exclusions
            }
            else {
                // console.log('checkbox: '+d+' unchecked.');
                exclude_langs.push(d);
                render_plot3(data, term, exclude_langs); // re-draw plot, adding lang to exclusions
            }
        });

    langs.forEach((lang) => { // language checkbox labels
        lang_buttons.select('div.'+lang)
            .append('label')
            .attr('for', lang)
            .html(lang.replaceAll('_', ' '))
            .style('text-transform', 'capitalize')
            .style('text-decoration', lang => `underline overline solid ${colorScale(lang)} ${border_width*3}px`) // match label colors to node colors
            // .style('color', colorScale(lang)); 
    });

    // make svg, tooltip?
    plot3.select('svg').remove(); // clear previous content
    const svg = plot3.append('svg')
        .attr('id', 'plot3svg')
        .attr("height", svgheight)
        .attr("width", svgwidth)
        .style('display', 'inline-block');
    plot3.select('#tooltip3').remove();
    const tooltip = plot3.append('div')
        .attr('id', "tooltip3") // re-draw tooltip on top of everything
        .style("visibility", 'hidden')
        .style("position", "absolute")
        // .style('width', tooltip_width)
        .style("padding", border_width)
        .style("background-color", page)
        .style("border", "1px solid black")
        .style("font-family", font_family)
        .style("font-size", legend_label_size)
        .style('text-transform', 'capitalize')
        .style('overflow-wrap', 'normal');

    // add chart title, plot background
    title = svg.append("text")
        .text("Etymology Explorer Tool")
        .attr("id", "chartTitle")
        .attr("x", (margin.left+svgwidth-margin.right)/2) // center title over chart
        .attr("y", margin.top/2)
        .attr("text-anchor", "middle")
        .style("font-size", title_size);
    svg.append('rect')
        .attr('class', 'plot_background')
        .attr('x', margin.left)
        .attr('y', margin.top)
        .attr('stroke', border_color)
        .attr('width', svgwidth-margin.left-margin.right)
        .attr('height', svgheight-margin.top-margin.bottom)
        .style('fill', plot_background);

    // handle error (word not in dataset)
    if (typeof rels == 'undefined') {
        svg_box = document.getElementById('plot3svg').getBoundingClientRect();
        plot3.append('div') // put error message div right on top of the svg
            .attr('id', 'plot3_error')
            .html(`The word "${term}" is not in my dataset. Try something else?`)
            .style('position', 'absolute')
            .style('left', svg_box.left+window.scrollX+margin.left)
            .style('top', svg_box.top+window.scrollY + (margin.top+svgheight-margin.bottom)/2 - title_size*1.5) // center error message on top of the svg plot
            .style('width', svgwidth-margin.left-margin.right)
            .style('font-size', title_size)
            .style('color', error_color)
            .style('text-anchor', 'middle')
            .style('text-align', 'center');
        return;
    }
    else {
        plot3.select("#plot3_error").remove();
    }

    // add links
    let link = svg.selectAll("line")
        .data(links)
        .enter()
        .append("line")
        .attr("stroke", link_color)
        .style("stroke-width", link_width)
        .style('stroke-dasharray', d => dashScale(d.value));

    // tooltip functionality - bring out for repeated use for node and label
    function tooltip_on(e,d) { // hover for tooltip
        let tiptext = 'Word: '+d.name;
        tiptext = tiptext+'<br>Language: '+(d.lang == 'term'? 'english' : d.lang.replace('_', ' ')); // target term is always going to be english
        if (d.reltypes.length > 1) { // multiple relationships with same word
            tiptext = tiptext+`<br>${term}'s Relationships to ${d.name}:`;
            tooltip.append('p')
                .html(tiptext);
            tooltip.append('ul').selectAll('li')
                .data(d.reltypes.sort())
                .enter().append('li')
                .html(rel => rel);
        }
        else if (d.reltypes.length > 0) { // one relationshi[]
            tiptext = tiptext+`<br>${term}'s Relationship to ${d.name}: ${d.reltypes[0]}`;
            tooltip.html(tiptext);
        }
        else { // no relationships (target term itself)
            tooltip.html(tiptext)
        }
        tooltip.style('visibility', 'visible')
            .style("left", (e.pageX + 10) + "px")
            .style("top", (e.pageY - 10) + "px");
    }
    function tooltip_off () { // done hovering - clear and hide tooltip
        tooltip.html('').style('visibility', 'hidden');
        }

    // add nodes
    let node = svg.selectAll("circle")
        .data(nodes)
        .enter()
        .append("circle")
        .attr('class', d => d.lang)
        .attr('r', r)
        .style('stroke',d => (d.lang == 'term'? term_color : colorScale(d.lang))) // target term gets its own color
        .style('stroke-width', node_stroke_width)
        .style("fill", plot_background)
        .on('mouseover', tooltip_on)
        .on('mouseout', tooltip_off);
    node.select('.term') // set the target node to the center of the plot space
        .attr('fx', (margin.left+svgwidth-margin.right)/2)
        .attr('fy', (margin.top+svgwidth-margin.bottom)/2);
    
    // add node labels
    let label = svg.selectAll(".nodelabel")
        .data(nodes)
        .enter()
        .append("text")
        .text(d => d.name)
        .attr('class', d => 'nodelabel '+d.name+' '+d.lang)
        .style("font-size", label_size)
        .style('font-weight', label_weight)
        .style('color', label_color)
        .style('text-anchor', 'middle')
        .style('stroke', label_outline)
        .style('stroke-width', label_outline_width)
        .on('mouseover', tooltip_on)
        .on('mouseout', tooltip_off);

    // add force simulation
    const force = d3.forceSimulation(nodes)
        .force("charge", d3.forceManyBody().strength(-1200))
        .force("link", d3.forceLink().links(links).id(d => d.id))
		.force('collision', d3.forceCollide().radius(r))
        .force('center', d3.forceCenter((margin.left+svgwidth-margin.right)/2, 
            (margin.top+svgwidth-margin.bottom)/2));

    force.on("tick", function() {
		link.attr("x1", function(d) { 
            // console.log(d);
            return d.source.x; })
            .attr("y1", function(d) { return d.source.y; })
            .attr("x2", function(d) { return d.target.x; })
            .attr("y2", function(d) { return d.target.y; });
        node.attr("cx", function(d) { return d.x; })
            .attr("cy", function(d) { return d.y; })
        label.attr("x", d => d.x)
            .attr("y", d=> d.y+label_size/2)
    });

    // add legend
    let legend = svg.append("g")
        .attr("class", "legend");
    let legend_box = legend.append("rect")
        .attr('class', 'border')
        .attr("id", "legendBorder1")
        .attr("x", 0)
        .attr("y",0)
        .attr("width", margin.right-2*border_width-2*link_width)
        .style("fill", plot_background)
        .style("stroke", "black")
        .style("stroke-width", border_width)
        .style('text-transform', 'capitalize');
    legend.append("text") // Legend Title
        .text("Relationship Type")
        .attr("x", margin.right/2-border_width-link_width)
        .attr("y", legend_title_size) // between title and label size
        .style("font-size", legend_title_size)
        .style('text-anchor', 'middle');
    
    let legend_height = legend_title_size;// track the total height of the legend, to draw border
    let add_to_legend = (reltype) => {
        // given a point, add the appropriate row to the legend
        let row = legend.select(`.${reltype}`);
        if (row.empty()) {  // only add new entries
            let text_length = 0;
            let text_height = 0;
            row = legend.append("g")
                .attr("class", `${reltype}`);
            row.append("text")
                .text(reltype)
                .attr("x", 0)
                .attr("y", legend_rowheight*0.6)
                .style("font-size", legend_label_size)
                .style('text-transform', 'capitalize')
                .style('padding', 0)
                .each(function () {
                    text_length = this.getBBox().width;
                    text_height = this.getBBox().y + this.getBBox().height/2 + 2;
                }); // get the length, height of the text box
            row.append('line')
                .attr('x1', 0)
                .attr('x2', text_length)
                .attr('y1', (text_height+legend_rowheight)/2) // between bottom of text and bottom of row
                .attr('y2', (text_height+legend_rowheight)/2)
                .attr("stroke", link_color)
                .style("stroke-width", link_width)
                .style('stroke-dasharray', dashScale(reltype));
            row.attr("transform", `translate(${2*link_width}, ${legend_height})`) // center row in margin
            legend_height = legend_height + legend_rowheight;
        }
    }
    legend_height = legend_height + legend_rowheight/2;
    reltypes.filter(d=> links.map(l=>l.value).includes(d)).forEach(d => add_to_legend(d));
    
    // vertically center legend, put border around legend
    legend_box.attr("height", legend_height);
    legend.attr("transform", `translate(${svgwidth-margin.right+2*link_width}, ${(margin.top + svgheight - margin.bottom -legend_height)/2})`); // put legend on the right side of the chart, halfway down chart interior

}