import LinkInput from '../components/LinkInput';
import ProgressBar from '../components/ProgressBar';

import React, {Component} from 'react';

import * as path from 'path';

const ffmpeg = window.require('fluent-ffmpeg');
const binaries = window.require('ffmpeg-binaries');
const sanitize = window.require('sanitize-filename');
const {ipcRenderer, remote} = window.require('electron');
const ytdl = window.require('ytdl-core');
const fs = window.require('fs-extra');

const AppContainer = (props) => {
    const initialBitRate = localStorage.getItem('userBitrate');
    const [state, setState] = React.useState({
        showProgressBar: false,
        progress: 0,
        bitrate: initialBitRate ? parseInt(initialBitRate) : 160,
        progressMessage: '',
        userDownloadsFolder: localStorage.getItem('userSelectedFolder')
            ? localStorage.getItem('userSelectedFolder')
            : remote.app.getPath('downloads')
    });
    ipcRenderer.on('changeBitrate', (event, newBitrate) => {
        setState({...state, bitrate: newBitrate});
        localStorage.setItem('userBitrate', newBitrate.toString());
    });

    // Signal from main process to show prompt to change the download to folder.
    ipcRenderer.on('promptForChangeDownloadFolder', () => {
        // Changing the folder in renderer because we need access to both state and local storage.
        changeOutputFolder();
    });

    // This property will be used to control the rate at which the progress bar is updated to prevent UI lag.
    const [rateLimitTriggered, setRateLimitTriggered] = React.useState(false);

    const getVideoAsMp4 = (urlLink, userProvidedPath, title): Promise<any> => {
        // Tell the user we are starting to get the video.
        setState({...state, progressMessage: 'Downloading...'});
        title = sanitize(title);
        return new Promise((resolve, reject) => {
            let fullPath = path.join(userProvidedPath, `tmp_${title}.mp4`);

            // Create a reference to the stream of the video being downloaded.
            let videoObject = ytdl(urlLink, {filter: 'audioonly'});

            videoObject.on('progress', (chunkLength, downloaded, total) => {
                // When the stream emits a progress event, we capture the currently downloaded amount and the total
                // to download, we then divided the downloaded by the total and multiply the result to get a float of
                // the percent complete, which is then passed through the Math.floor function to drop the decimals.
                if (!rateLimitTriggered) {
                    let newVal = Math.floor((downloaded / total) * 100);
                    setState({...state, progress: newVal});

                    // Set the rate limit trigger to true and set a timeout to set it back to false. This will prevent the UI
                    // from updating every few milliseconds and creating visual lag.
                    setRateLimitTriggered(true);
                    setTimeout(() => {
                        setRateLimitTriggered(false);
                    }, 800);
                }
            });

            // Create write-able stream for the temp file and pipe the video stream into it.
            videoObject.pipe(fs.createWriteStream(fullPath)).on('finish', () => {
                // all of the video stream has finished piping, set the progress bar to 100% and give user pause to see the
                // completion of step. Then we return the path to the temp file, the output path, and the desired filename.
                setState({...state, progress: 100});
                setTimeout(() => {
                    resolve({filePath: fullPath, folderPath: userProvidedPath, fileTitle: `${title}.mp3`});
                }, 1000);
            });
        });
    };

    const convertMp4ToMp3 = (paths) => {
        // Tell the user we are starting to convert the file to mp3.
        setState({...state, progressMessage: 'Converting...', progress: 0});

        return new Promise((resolve, reject) => {
            // Reset the rate limiting trigger just encase.
            setRateLimitTriggered(false);

            // Pass ffmpeg the temp mp4 file. Set the path where is ffmpeg binary for the platform. Provided desired format.
            ffmpeg(paths.filePath)
                .setFfmpegPath(binaries.ffmpegPath())
                .format('mp3')
                .audioBitrate(state.bitrate)
                .on('progress', (progress) => {
                    // Use same rate limiting as above in function "getVideoAsMp4()" to prevent UI lag.
                    if (!rateLimitTriggered) {
                        setState({...state, progress: Math.floor(progress.percent)});
                        setRateLimitTriggered(true);
                        setTimeout(() => {
                            setRateLimitTriggered(false);
                        }, 800);
                    }
                })
                .output(fs.createWriteStream(path.join(paths.folderPath, sanitize(paths.fileTitle))))
                .on('end', () => {
                    // After the mp3 is wrote to the disk we set the progress to 99% the last 1% is the removal of the temp file.
                    setState({...state, progress: 99});
                    resolve(undefined);
                })
                .run();
        });
    };

    const startDownload = async (id) => {
        // Reset state for each download/conversion
        setState({
            ...state,
            progress: 0,
            showProgressBar: true,
            progressMessage: '...'
        });

        try {
            // Tell the user we are getting the video info, and call the function to do so.
            setState({...state, progressMessage: 'Fetching video info...'});
            let info = await ytdl.getInfo(id);

            // Given the id of the video, the path in which to store the output, and the video title
            // download the video as an audio only mp4 and write it to a temp file then return
            // the full path for the tmp file, the path in which its stored, and the title of the desired output.
            let paths = await getVideoAsMp4(id, state.userDownloadsFolder, info.title);

            // Pass the returned paths and info into the function which will convert the mp4 tmp file into
            // the desired output mp3 file.
            await convertMp4ToMp3(paths);

            // Remove the temp mp4 file.
            fs.unlinkSync(paths.filePath);

            // Set the bar to 100% and give the OS about one second to get rid of the temp file.

            () => {
                return new Promise<void>((resolve, _reject) => {
                    setTimeout(() => {
                        setState({...state, progress: 100});
                        resolve();
                    }, 900);
                });
            };

            // Signal that the download and conversion have completed and we need to tell the user about it and then reset.
            downloadFinished();
        } catch (e) {
            console.error(e);
        }
    };

    const downloadFinished = () => {
        // Make sure progress bar is at 100% and tell the user we have completed the task successfully.
        setState({
            ...state,
            progress: 100,
            progressMessage: 'Conversion successful!'
        });

        // Reset the progress bar to the LinkInput
        setTimeout(
            () =>
                setState({
                    ...state,
                    showProgressBar: false
                }),
            2000
        );
    };

    const changeOutputFolder = () => {
        // Create an electron open dialog for selecting folders, this will take into account platform.
        let fileSelector = remote.dialog.showOpenDialog({
            defaultPath: `${state.userDownloadsFolder}`,
            properties: ['openDirectory'],
            title: 'Select folder to store files.'
        });

        // If a folder was selected and not just closed, set the localStorage value to that path and adjust the state.
        if (fileSelector) {
            let pathToStore = fileSelector[0];
            localStorage.setItem('userSelectedFolder', pathToStore);
            setState({...state, userDownloadsFolder: pathToStore});
        }
    };

    if (state.showProgressBar) {
        return <ProgressBar progress={state.progress} messageText={state.progressMessage} />;
    } else {
        return <LinkInput startDownload={startDownload} />;
    }
};

export default AppContainer;
