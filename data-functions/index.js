const exec = require('child_process').exec;
const path = require('path');
const os =  require('os');
const fs = require('fs');
const Datastore = require('@google-cloud/datastore');
const Storage = require('@google-cloud/storage');
const vision = require('@google-cloud/vision');

const datastore = Datastore();
const storage = Storage();
// create a new client for the vision API
const client = new vision.ImageAnnotatorClient();

exports.imageTagger = (event) => {
    return tagger(event);
}
exports.deleteTagger = (event) => {
    return tagger(event);
}

tagger = (event) => {
    const object = event.data;
    // The data property changes based on the trigger type
    console.log(object);
    if(event.context.eventType === 'google.storage.object.delete'){
        object.resourceState = 'not_exists';
    }else{
        object.resourceState = 'exists';
    }
    // check if the object is an image
    if(!object.contentType.startsWith('image/')){
        console.log('This is not an image');
        callback()
        return;
    }
}

function processLabels(bucketObject) {
    const storagePath = `gs://${bucketObject.bucket}/${bucketObject.name}`;
    const query = datastore.createQuery('Images').select('__key__').limit(1);
    query.filter('storagePath', '=', storagePath);
    return query.run().then(data => {
        const objectExists = data[0].length > 0;
        const key = objectExists ? data[0][0][datastore.KEY] : datastore.key('Images');

        if(objectExists && bucketObject.resourceState == 'not_exists'){
            return datastore.delete(key).then(() => {
                console.log('Successfully deleted entity');
            });
        } else {
            // Generate thumbnails
            // Generate vision labels
        }
    })
    .catch(err => {
        console.error('Query run received an error', err);
    })
}

function processImageLabels(storagePath, key){
    return client.labelDetection(storagePath).then(results => {
        console.log(results);
        const labels = results[0].labelAnnotations;
        const descriptions = labels.filter((label) => label.score >= 0.65)
        .map((label) => label.description);
        return const entity = {
            key: key,
            data: {
                storagePath: storagePath,
                tags: descriptions
            }
        };
        // return datastore.save(entity);
    })
    .catch(err => {
        console.error('Vision api returned failure:', err);
    })
}
function mkDirAsync(dir){
    return new Promise((resolve, reject) =>  {
        fs.lstat(dir, (err, stats) => {
            if(err){
                if(err.code === 'ENOENT'){
                    fs.mkdir(dir, (err) => {
                        if(err){
                            reject(err);
                        }else{
                            console.log('created directory');
                            resolve();
                        }
                    })
                }else{
                    reject(err);
                }
            }else{
                if(stats.isDirectory()){
                    console.log(`${dir} already exists`);
                    resolve();
                }else{
                    reject(new Error('A directory was not passed to this function'));
                }
            }
        })
    })
}