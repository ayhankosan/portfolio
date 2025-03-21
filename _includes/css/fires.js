//-------------------------- WATER MASKING ----------------------------//

/**
 * Compute the Normalized Difference Water Index (NDWI).
 * @param {ee.Image} image - Landsat image.
 * @returns {ee.Image} - Image with computed NDWI.
 */
function computeNDWI(image) {
    return image.normalizedDifference(['B3', 'B5']).rename('NDWI');
}

// Compute NDWI for Pre-Fire Image
var preNDWI = computeNDWI(preFireImage);

// Create Water Mask (NDWI > 0.3 indicates water)
var waterMask = preNDWI.gt(0.3);

// Apply Water Mask to Images
preFireImage = preFireImage.updateMask(waterMask.not());
postFireImage = postFireImage.updateMask(waterMask.not());

// Recompute NBR and dNBR with Water Mask Applied
var preNBR  = computeNBR(preFireImage);
var postNBR = computeNBR(postFireImage);
var dNBR = preNBR.subtract(postNBR).rename('dNBR');

// Recompute Burn Severity with Water Mask Applied
var burnSeverity = dNBR.expression(
    "(b('dNBR') <= 0.1) ? 1 : " +
    "(b('dNBR') <= 0.27) ? 2 : " +
    "(b('dNBR') <= 0.44) ? 3 : " +
    "(b('dNBR') <= 0.66) ? 4 : 5", {}
).rename('BurnSeverity');

//-------------------------- VISUALIZATION ---------------------------//

// Visualization Parameters
var dNBRViz = { min: -0.1, max: 1, palette: ['green', 'yellow', 'orange', 'red', 'black'] };
var burnSeverityViz = { min: 1, max: 5, palette: ['green', '#f6fa34', '#edb149', '#e86b27', '#9c24d2'] };

// Center Map on AOI
Map.centerObject(aoi, 11);

// Add Layers to Map
Map.addLayer(preFireImage, {bands: ['B4', 'B3', 'B2'], min: 0, max: 0.3}, 'Pre-Fire Image');
Map.addLayer(postFireImage, {bands: ['B4', 'B3', 'B2'], min: 0, max: 0.3}, 'Post-Fire Image');
Map.addLayer(dNBR, dNBRViz, 'dNBR - Burn Severity Index');
Map.addLayer(burnSeverity, burnSeverityViz, 'Burn Severity Classification');

//-------------------------- BURN AREA CALCULATION --------------------//

// Identify Burned Areas (burn severity greater than 'Unburned')
var burnedArea = burnSeverity.gt(1).selfMask();

// Calculate Burned Area in Square Kilometers
var burnedPixelArea = burnedArea.multiply(ee.Image.pixelArea());
var totalBurnedArea = burnedPixelArea.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: aoi,
    scale: 30,
    bestEffort: true
}).getNumber('BurnSeverity').divide(1e6); // Convert from m² to km²

// Print Total Burned Area
totalBurnedArea.evaluate(function(area) {
    print("Total Burned Area (km²):", area);
});

//-------------------------- LEGEND ---------------------------//

// Create Legend Panel
var legend = ui.Panel({
    style: { position: 'bottom-left', padding: '8px 15px' }
});

// Legend Title
legend.add(ui.Label({
    value: 'Burn Severity Classification',
    style: { fontWeight: 'bold', fontSize: '16px' }
}));

// Define Legend Colors and Labels
var legendColors = ['green', '#f6fa34', '#edb149', '#e86b27', '#9c24d2'];
var legendLabels = ['Unburned', 'Low', 'Moderate-Low', 'Moderate-High', 'High'];

// Generate Legend Items
for (var i = 0; i < legendColors.length; i++) {
    legend.add(ui.Panel({
        widgets: [
            ui.Label({ style: { backgroundColor: legendColors[i], padding: '8px', margin: '4px' } }),
            ui.Label({ value: legendLabels[i], style: { margin: '4px' } })
        ],
        layout: ui.Panel.Layout.Flow('horizontal')
    }));
}

// Add Legend to Map
Map.add(legend);

//-------------------------- SUMMARY PANEL ---------------------------//

// Create Summary Panel
var summaryPanel = ui.Panel({
    style: { position: 'bottom-right', padding: '10px', width: '350px' }
});

// Add Summary Title
summaryPanel.add(ui.Label({
    value: 'Palisades Fire Burn Severity Analysis',
    style: { fontWeight: 'bold', fontSize: '18px' }
}));

// Add Total Burned Area to Summary Panel
totalBurnedArea.evaluate(function(area) {
    summaryPanel.add(ui.Label({
        value: 'Total Burned Area (km²): ' + area,
        style: { fontSize: '14px' }
    }));
});

// Add Summary Panel to Map
Map.add(summaryPanel);

//-------------------------- ADDITIONAL SPECTRAL INDICES -------------//

var preNDVI  = computeNDVI(preFireImage);
var postNDVI = computeNDVI(postFireImage);
var preNDWI  = computeNDWI(preFireImage);
var postNDWI = computeNDWI(postFireImage);

// Compute Differences in NDVI (dNDVI) and NDWI (dNDWI)
var dNDVI = preNDVI.subtract(postNDVI).rename('dNDVI');
var dNDWI = preNDWI.subtract(postNDWI).rename('dNDWI');

//-------------------------- UPDATED VISUALIZATION --------------------//

// Visualization Parameters for Additional Indices
var ndviViz   = { min: -1, max: 1, palette: ['blue', 'white', 'green'] };
var ndwiViz   = { min: -1, max: 1, palette: ['brown', 'white', 'blue'] };
var dNDVIViz  = { min: -1, max: 1, palette: ['red', 'white', 'green'] };
var dNDWIViz  = { min: -1, max: 1, palette: ['red', 'white', 'blue'] };

// Add Layers to Map for Additional Indices
Map.addLayer(preNDVI, ndviViz, 'Pre-Fire NDVI');
Map.addLayer(postNDVI, ndviViz, 'Post-Fire NDVI');
Map.addLayer(dNDVI, dNDVIViz, 'dNDVI - Vegetation Change');
Map.addLayer(preNDWI, ndwiViz, 'Pre-Fire NDWI');
Map.addLayer(postNDWI, ndwiViz, 'Post-Fire NDWI');
Map.addLayer(dNDWI, dNDWIViz, 'dNDWI - Water Change');

//-------------------------- BURN CLASS STATISTICS --------------------//

// Calculate the number of pixels in each burn severity class
var burnClassStats = burnSeverity.reduceRegion({
        reducer: ee.Reducer.frequencyHistogram(),
        geometry: aoi,
        scale: 30,
        bestEffort: true
}).get('BurnSeverity');

// Print Burn Class Statistics
burnClassStats.evaluate(function(stats) {
        print("Burn Class Statistics:", stats);
        
        // Add Burn Class Statistics to Summary Panel
        for (var key in stats) {
                var index = parseInt(key) - 1;
                if (index >= 0 && index < legendLabels.length) {
                        summaryPanel.add(ui.Label({
                                value: legendLabels[index] + ': ' + stats[key] + ' pixels',
                                style: { fontSize: '14px' }
                        }));
                }
        }
        // Create a list of burn class counts ensuring all 5 classes are included
        var burnStatsList = ee.List([
            ee.Dictionary(stats).get('3', 0),
            ee.Dictionary(stats).get('4', 0),
            ee.Dictionary(stats).get('5', 0)
        ]);
        
        // Create a chart to display the distribution of burn severity classes
        var chart = ui.Chart.array.values({
                array: ee.Array(burnStatsList),
                axis: 0,
                xLabels: legendLabels.slice(2) // Only include labels for classes 3, 4, and 5
        }).setChartType('ColumnChart')
            .setOptions({
                    title: 'Burn Severity Distribution',
                    hAxis: { title: 'Burn Severity Class' },
                    vAxis: { title: 'Number of Pixels' },
                    legend: { position: 'none' },
                    colors: ['#1f77b4']
            });
        
        // Add the chart to the summary panel
        summaryPanel.add(chart);
});

// Filter burn severity to only include classes 3 and higher
var filteredBurnSeverity = burnSeverity.updateMask(burnSeverity.gte(3));

// Move Burn Severity Classification Layer to Top
Map.layers().get(3).setShown(false); // Hide the previous burn severity layer
Map.addLayer(filteredBurnSeverity, burnSeverityViz, 'Burn Severity Classification (3 and higher)', true, 1);
