function load(){
    let ety= "../data/test_english.csv"; // TODO: change to english.csv when done with development
    let countries="../data/List_of_official_languages_by_country_and_territory_1.csv"
    process(ety, countries);
}

function process(ety, countries) {
    //preprocess data
    let rowConverter_ety = (d) => {return {
        word: d.word,
        tag: ((d.group_tag.length > 0)? d.group_tag : d.parent_tag),
        lang: d.lang,
        related_lang: d.related_lang,
        related_word: d.related_word,
        reltype: d.reltype.replace('_of','').replace('_from','').replace('_to','').replaceAll('_',' '),
        root: d.reltype.includes('root')
    }};
    d3.csv(ety, rowConverter_ety).then(function(ety){
        console.log(ety)
        plot1(ety);

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
            plot2(ety, countries);
        });
    });
}

function plot1(data) {
    // dimensional constants
    const svgwidth = 800;
    const svgheight = 600;
    const margin = {top:50, bottom: 100, left: 100, right:160};

    const font_family = "Comic Sans MS";
    const label_size = 16;
    const tick_size = label_size*0.7;
    const label_padding = 75; // padding between axis and axis labels
    const title_size = 20;
    const tick_rotate = -45;

    const bar_count = 8 // TODO: MAKE THIS INTERACTIVE? (i.e. a box where the user can enter the # of bars they want to show)
    
    const legend_title_size = (title_size+label_size)/2;
    const legend_label_size = tick_size;
    const legend_rowheight = legend_label_size * 1.5;
    const legend_r = 3;
    const legend_border_width = 1;
    const scale_buffer = 0.1;

    // group data
    let rolled = d3.rollup(data, g=>g.length/1000, d=>d.related_lang, d=>d.reltype); // number of count per year for each country
    relcounts = [];
    rolled.forEach((innerMap, lang) => {
        if (lang.length > 0 && lang != 'English') // ignore blank related_lang and ignore English relationships
            {row = Object.fromEntries(innerMap);
            Object.assign(row, {'total': d3.sum(Object.values(row))});
            Object.assign(row, {'lang':lang});
            relcounts.push(row);}
    });
    console.log(relcounts)

    relcounts = relcounts.sort((a,b)=> b.total-a.total).slice(0,bar_count) // only keep top bar_count languages
    console.log(relcounts)

    reltypes = new Set(); // for easy tracking of unique values
    relcounts.forEach(row => Object.keys(row).forEach(reltype => reltypes.add(reltype))); // for each language, add the new relationship types to the set
    reltypes.delete('lang');
    reltypes.delete('total');
    reltypes = Array.from(reltypes.values())

    // scales and axes
    let langs = relcounts.map(d=>d.lang).sort();
    let xScale = d3.scaleBand()
        .domain(langs)
        .range([margin.left, svgwidth-margin.right])
        .padding(0.1);
    let xAxis = d3.axisBottom()
        .scale(xScale);
    
    let counts = relcounts.map(d => d3.sum(Object.values(d)));
    let max_count = d3.max(counts);
    let min_count = 0 //d3.min(counts);
    let count_buffer = scale_buffer*(max_count-min_count)
    let yScale = d3.scaleLinear()
        .domain([min_count, max_count+count_buffer])
        .range([svgheight-margin.bottom, margin.top]);
    let yAxis = d3.axisLeft().scale(yScale);

    let colorScale = (rel) => d3.interpolateSinebow(reltypes.indexOf(rel)/reltypes.length);
    
    // make svg canvas, tooltip
    svg = d3.select("#plot1").append("svg")
        .attr("height", svgheight)
        .attr("width", svgwidth);
    tooltip = d3.select("#plot1").append("div")
        .attr("id", "tooltip")
        .style("font-family", font_family)
        .style("font-size", tick_size)
        .style("opacity", 0)
        .style("position", "absolute")
        .style("background-color", "white")
        .style("border", "1px solid black")
        .style("padding", legend_border_width)
        .style('text-transform', 'capitalize');

    // add axes, axes titles, chart title
    x_ax = svg.append("g").call(xAxis) // x axis
        .attr("class", "xAxis")
        .attr("transform", `translate(0,${svgheight-margin.bottom})`)
        .style("font-size", tick_size)
        .style("font-family", font_family);
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
        .text("Common Origins of English Words")
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
                    lang = d.data.lang
                    tiptext = "Language: "+lang
                    total = Math.round(d.data.total*1000) // convert back to # of words (instead of thousands)
                    tiptext = tiptext + "<br>Total words: "+total
                    reltype = d3.select(this.parentNode).attr("class")
                    // tiptext = tiptext + "<br>Relationship Type: "+reltype
                    count = Math.round(d.data[reltype]*1000)
                    tiptext = tiptext + "<br>"+reltype+" words: "+count
                    tooltip.html(tiptext)
                        .style("opacity", 1)
                        .style("left", (e.pageX + 10) + "px")
                        .style("top", (e.pageY - 10) + "px");
                })
                .on('mouseout', () => tooltip.style("opacity", 0));

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

function plot2(ety, countries) {
    // TODO
}

function plot3(ety) {
    // TODO
}