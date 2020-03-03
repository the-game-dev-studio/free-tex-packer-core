let Jimp = require("jimp");
let PackProcessor = require("./PackProcessor");
let TextureRenderer = require("./utils/TextureRenderer");
let startExporter = require("./exporters/index").startExporter;
const imagemin = require('imagemin');
const imageminPngquant = require('imagemin-pngquant');
const imageminJpegoptim = require('imagemin-jpegoptim');


class FilesProcessor {

    static start(images, options, callback, errorCallback) {
        PackProcessor.pack(images, options,
            (res) => {
                let packResult = [];
                let resFiles = [];
                let readyParts = 0;

                for (let data of res) {
                    new TextureRenderer(data, options, (renderResult) => {
                        packResult.push({
                            data: renderResult.data,
                            buffer: renderResult.buffer
                        });

                        if (packResult.length >= res.length) {
                            let ix = 0;
                            for (let item of packResult) {
                                let fName = options.textureName + (packResult.length > 1 ? "-" + ix : "");

                                FilesProcessor.processPackResultItem(fName, item, options, (files) => {
                                    resFiles = resFiles.concat(files);
                                    readyParts++;
                                    if (readyParts >= packResult.length) {
                                        callback(resFiles);
                                    }
                                });

                                ix++;
                            }
                        }
                    });
                }
            },
            (error) => {
                if (errorCallback) errorCallback(error);
            });
    }

    static processPackResultItem(fName, item, options, callback) {
        let files = [];

        let pixelFormat = options.textureFormat == "png" ? "RGBA8888" : "RGB888";
        let mime = options.textureFormat == "png" ? Jimp.MIME_PNG : Jimp.MIME_JPEG;


        item.buffer.getBuffer(mime, (err, srcBuffer) => {
            FilesProcessor.optimizeImage(srcBuffer, options, (buffer) => {
                let opts = {
                    imageName: fName + "." + options.textureFormat,
                    imageData: buffer.toString("base64"),
                    format: pixelFormat,
                    textureFormat: options.textureFormat,
                    imageWidth: item.buffer.bitmap.width,
                    imageHeight: item.buffer.bitmap.height,
                    removeFileExtension: options.removeFileExtension,
                    prependFolderName: options.prependFolderName,
                    base64Export: options.base64Export,
                    scale: options.scale,
                    appInfo: options.appInfo,
                    trimMode: options.trimMode
                };
                files.push({
                    name: fName + "." + options.exporter.fileExt,
                    buffer: Buffer.from(startExporter(options.exporter, item.data, opts))
                });

                if (!options.base64Export) {
                    files.push({
                        name: fName + "." + options.textureFormat,
                        buffer: buffer
                    });
                }
                if (options.sdVariant) {
                    item.buffer.scale(0.5).getBuffer(mime, (err, srcBuffer) => {
                        FilesProcessor.optimizeImage(srcBuffer, options, (buffer) => {
                            files.push({
                                name: fName + "@0.5x." + options.textureFormat,
                                buffer: buffer
                            });
                            callback(files);
                        })
                    })
                } else {
                    callback(files);
                }
            });
        });
    }

    static optimizeImage(buffer, options, callback) {
        if (!options.optimize) {
            callback(buffer);
            return;
        }

        imagemin.buffer(buffer, {
            plugins: [
                imageminPngquant(options.optimizeOptions),
                imageminJpegoptim()
            ]
        }).then(result => callback(result));

    }
}

module.exports = FilesProcessor;