
//Path of the Code in GEE code editor
/* https://code.earthengine.google.com/?scriptPath=users%2Fbehzadsk12%2Fbehzad_sk%3ASentinel_1_Classification
*/


Map.centerObject(roi, 9)

// Import Sentinel-1 collection
var sentinel1 =  ee.ImageCollection('COPERNICUS/S1_GRD')
                    .filterBounds(roi)
                    .filterDate('2023-08-01', '2023-09-30')
                    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
                    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
                    .filter(ee.Filter.eq('instrumentMode', 'IW'));
var desc = sentinel1.filter(ee.Filter.eq('orbitProperties_pass', 'DESCENDING'));
var asc = sentinel1.filter(ee.Filter.eq('orbitProperties_pass', 'ASCENDING'));

// Inspect number of tiles returned after the search; we will use the one with more tiles
print("descending tiles ",desc.size());
print("ascending tiles ",asc.size());
// Also Inspect one file
print(asc.first());
print(desc.first());
// Create a composite from means at different polarizations and look angles.
/*
var vvIwAsc = asc.select('VV').mean().clip(roi)
var vhIwAsc = asc.select('VH').mean().clip(roi)
var vvIwDes = desc.select('VH').mean().clip(roi)
*/
var composite = ee.Image.cat([
  asc.select('VH').mean(),
  asc.select('VV').mean(),
  desc.select('VH').mean()
]).focal_median();
var composite = composite.clip(roi);
// Display as a composite of polarization and backscattering characteristics.
/*Map.addLayer(vvIwAsc, {}, 'vvIwAsc');
Map.addLayer(vhIwAsc, {}, 'vhIwAsc');
Map.addLayer(vvIwDes, {}, 'vvIwDes');*/
Map.addLayer(composite, {min: [-25, -20, -25], max: [0, 10, 0]}, 'composite');


// Merge points together

var newfc = water.merge(forest).merge(barren).merge(urban);
print(newfc, 'newfc');

var Bands_selection=['VV','VH'];
//overlay
var training = composite.sampleRegions({
  collection:newfc,
  properties:['landcover'],
  scale:10
});

///SPLITS:Training(75%) & Testing samples(25%).
var Total_samples=training.randomColumn('random');
var training_samples=Total_samples.filter(ee.Filter.lessThan('random',0.75));
print(training_samples,"Training Samples");
var validation_samples=Total_samples.filter(ee.Filter.greaterThanOrEquals('random',0.75));
print(validation_samples,"Validation_Samples");


//---------------RANDOM FOREST CLASSIFER-------------------/
// var classifier = ee.Classifier.smileRandomForest(numberOfTrees, variablesPerSplit, minLeafPopulation, bagFraction, maxNodes, seed)
var classifier=ee.Classifier.smileRandomForest(10).train({
features:training,
classProperty:'landcover',
inputProperties:Bands_selection
})
var classified=composite.classify(classifier);
// Define a palette for the Land Use classification.
var palette = [
  'Blue', // water (1) 
  'green', //  forest (2) 
  'fec89a',// barren (3) 
  'Red'  // urban (4) 
];
var classified = classified.clip(roi)
Map.addLayer(classified,{min: 1, max: 4,palette: palette},"classification");
//Map.centerObject(roi,10);

var confusionMatrix =classifier.confusionMatrix();
print(confusionMatrix,'Error matrix: ');
print(confusionMatrix.accuracy(),'Training Overall Accuracy: ');


Export.image.toDrive({
  image:classified, 
  description: 'Classified_Image', 
  region:roi, 
  scale:10, 
  crs:'EPSG:4326', 
  maxPixels:1e13
  
})