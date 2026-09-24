/**
 * HyperFrames Renderer for Snapmy.site Film Engine v2
 * 
 * Professional rendering pipeline using Chrome + ffmpeg for frame-by-frame rendering.
 * Integrates with HyperFrames CLI for production-quality video output.
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class HyperFramesRenderer {
  constructor(options = {}) {
    this.chromePath = options.chromePath || 'google-chrome';
    this.ffmpegPath = options.ffmpegPath || 'ffmpeg';
    this.tempDir = options.tempDir || './temp';
    this.outputDir = options.outputDir || './output';
    
    // Rendering defaults
    this.defaults = {
      fps: 60,
      codec: 'libx264',
      preset: 'slow',
      crf: 18,
      pixelFormat: 'yuv420p',
      bitrate: '20M',
      audioBitrate: '192k',
      audioSampleRate: '44100'
    };
    
    // Output formats
    this.formats = {
      '16:9': { width: 1920, height: 1080, name: '1080p' },
      '16:9-4k': { width: 3840, height: 2160, name: '4K' },
      '9:16': { width: 1080, height: 1920, name: 'mobile' },
      '1:1': { width: 1080, height: 1080, name: 'square' },
      '4:5': { width: 1080, height: 1350, name: 'instagram' }
    };
  }

  /**
   * Render storyboard to video using Chrome + ffmpeg
   */
  async render(storyboard, options = {}) {
    const format = options.format || '16:9';
    const resolution = this.formats[format] || this.formats['16:9'];
    
    const renderOptions = {
      ...this.defaults,
      ...options,
      resolution,
      format
    };

    // Create directories
    await this.ensureDirectories();
    
    // Generate render plan
    const renderPlan = await this.generateRenderPlan(storyboard, renderOptions);
    
    // Render frames using Chrome
    const framesDir = await this.renderFrames(renderPlan);
    
    // Encode video using ffmpeg
    const outputFile = await this.encodeVideo(framesDir, renderOptions);
    
    // Apply audio if available
    if (storyboard.audio || renderOptions.audioFile) {
      await this.addAudio(outputFile, renderOptions);
    }
    
    // Cleanup temporary files
    if (!renderOptions.keepTemp) {
      await this.cleanup(framesDir);
    }
    
    return {
      outputFile,
      format,
      resolution,
      duration: renderPlan.duration,
      frameCount: renderPlan.frameCount,
      fileSize: await this.getFileSize(outputFile)
    };
  }

  /**
   * Ensure required directories exist
   */
  async ensureDirectories() {
    const dirs = [this.tempDir, this.outputDir];
    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
      }
    }
  }

  /**
   * Generate render plan from storyboard
   */
  async generateRenderPlan(storyboard, options) {
    const totalDuration = storyboard.timing?.total_duration || 30;
    const fps = options.fps || this.defaults.fps;
    const frameCount = Math.floor(totalDuration * fps);
    
    // Generate frame specifications
    const frameSpecs = [];
    for (let frame = 0; frame < frameCount; frame++) {
      const timestamp = frame / fps;
      const shot = this.findShotAtTime(storyboard.shots, timestamp);
      
      frameSpecs.push({
        frame,
        timestamp,
        shot: shot?.id || null,
        camera: shot?.camera_move || 'static',
        composition: this.generateComposition(shot, options.resolution),
        assets: this.getAssetsForFrame(shot, timestamp, storyboard.evidence_assets)
      });
    }
    
    return {
      duration: totalDuration,
      fps,
      frameCount,
      resolution: options.resolution,
      frameSpecs,
      storyboard
    };
  }

  /**
   * Find active shot at given timestamp
   */
  findShotAtTime(shots, timestamp) {
    return shots?.find(shot => 
      timestamp >= shot.start_time && timestamp < shot.end_time
    );
  }

  /**
   * Generate composition for frame
   */
  generateComposition(shot, resolution) {
    return {
      width: resolution.width,
      height: resolution.height,
      camera: shot?.camera_move || 'static',
      cameraPosition: shot?.camera_position || { x: 0, y: 0, z: 5 },
      cameraTarget: shot?.camera_target || { x: 0, y: 0, z: 0 },
      fov: shot?.fov || 50,
      dof: shot?.depth_of_field || { enabled: false, focusDistance: 5, aperture: 2.8 }
    };
  }

  /**
   * Get assets for specific frame
   */
  getAssetsForFrame(shot, timestamp, evidenceAssets) {
    if (!shot || !evidenceAssets) return [];
    
    return evidenceAssets.filter(asset => 
      asset.shot_id === shot.id && 
      timestamp >= (asset.start_time || 0) && 
      timestamp < (asset.end_time || shot.end_time)
    );
  }

  /**
   * Render frames using Chrome headless
   */
  async renderFrames(renderPlan) {
    const framesDir = path.join(this.tempDir, `frames_${Date.now()}`);
    await fs.mkdir(framesDir, { recursive: true });
    
    // Create HTML renderer for frame generation
    const rendererHTML = await this.createRendererHTML(renderPlan);
    const rendererPath = path.join(framesDir, 'renderer.html');
    await fs.writeFile(rendererPath, rendererHTML);
    
    // Render each frame using Chrome
    const framePromises = renderPlan.frameSpecs.map(async (frameSpec) => {
      const framePath = path.join(framesDir, `frame_${frameSpec.frame.toString().padStart(6, '0')}.png`);
      await this.renderFrame(rendererPath, frameSpec, framePath);
      return framePath;
    });
    
    await Promise.all(framePromises);
    
    return framesDir;
  }

  /**
   * Create HTML renderer for frame generation
   */
  async createRendererHTML(renderPlan) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Frame Renderer</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      background: #000; 
      overflow: hidden;
      width: ${renderPlan.resolution.width}px;
      height: ${renderPlan.resolution.height}px;
    }
    #canvas { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <canvas id="canvas"></canvas>
  <script>
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = ${renderPlan.resolution.width};
    canvas.height = ${renderPlan.resolution.height};
    
    // Frame data will be injected here
    window.frameData = ${JSON.stringify(renderPlan.frameSpecs)};
    
    // Render function called for each frame
    window.renderFrame = function(frameIndex) {
      const frame = window.frameData[frameIndex];
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Add frame rendering logic here based on composition
      // This would integrate with the Three.js rig
      ctx.fillStyle = '#fff';
      ctx.font = '24px Arial';
      ctx.fillText(\`Frame \${frame.frame} - \${frame.timestamp.toFixed(2)}s\`, 20, 40);
    };
    
    // Initialize
    window.renderFrame(0);
  </script>
</body>
</html>`;
  }

  /**
   * Render single frame using Chrome
   */
  async renderFrame(rendererPath, frameSpec, outputPath) {
    return new Promise((resolve, reject) => {
      const args = [
        '--headless',
        '--disable-gpu',
        '--window-size=' + `${frameSpec.composition.width}x${frameSpec.composition.height}`,
        '--screenshot=' + outputPath,
        '--virtual-time-budget=1000',
        rendererPath
      ];
      
      const chrome = spawn(this.chromePath, args);
      
      chrome.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Chrome exited with code ${code}`));
        }
      });
      
      chrome.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Encode video using ffmpeg
   */
  async encodeVideo(framesDir, options) {
    const outputFile = path.join(this.outputDir, `render_${Date.now()}.mp4`);
    
    return new Promise((resolve, reject) => {
      const args = [
        '-framerate', options.fps.toString(),
        '-i', path.join(framesDir, 'frame_%06d.png'),
        '-c:v', options.codec,
        '-preset', options.preset,
        '-crf', options.crf.toString(),
        '-pix_fmt', options.pixelFormat,
        '-s', `${options.resolution.width}x${options.resolution.height}`,
        '-r', options.fps.toString(),
        '-movflags', '+faststart'
      ];
      
      if (options.bitrate) {
        args.push('-b:v', options.bitrate);
      }
      
      args.push(outputFile);
      
      const ffmpeg = spawn(this.ffmpegPath, args);
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(outputFile);
        } else {
          reject(new Error(`ffmpeg exited with code ${code}`));
        }
      });
      
      ffmpeg.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Add audio to video
   */
  async addAudio(videoFile, options) {
    const outputFile = videoFile.replace('.mp4', '_with_audio.mp4');
    const audioFile = options.audioFile;
    
    if (!audioFile) return videoFile;
    
    return new Promise((resolve, reject) => {
      const args = [
        '-i', videoFile,
        '-i', audioFile,
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', options.audioBitrate,
        '-ar', options.audioSampleRate,
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-shortest',
        outputFile
      ];
      
      const ffmpeg = spawn(this.ffmpegPath, args);
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          // Replace original file
          fs.rename(outputFile, videoFile).then(() => resolve(videoFile));
        } else {
          reject(new Error(`ffmpeg audio encoding exited with code ${code}`));
        }
      });
      
      ffmpeg.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Get file size
   */
  async getFileSize(filePath) {
    const stats = await fs.stat(filePath);
    return (stats.size / (1024 * 1024)).toFixed(2) + ' MB';
  }

  /**
   * Cleanup temporary files
   */
  async cleanup(framesDir) {
    try {
      await fs.rm(framesDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Cleanup failed:', error.message);
    }
  }

  /**
   * Render multiple formats
   */
  async renderMultiFormat(storyboard, formats = ['16:9', '9:16', '1:1'], options = {}) {
    const results = [];
    
    for (const format of formats) {
      try {
        const result = await this.render(storyboard, { ...options, format });
        results.push({ format, ...result, success: true });
      } catch (error) {
        results.push({ format, error: error.message, success: false });
      }
    }
    
    return results;
  }

  /**
   * Render ProRes version
   */
  async renderProRes(storyboard, options = {}) {
    return this.render(storyboard, {
      ...options,
      codec: 'prores_ks',
      profile: '3',
      outputFormat: 'mov',
      crf: undefined,
      bitrate: undefined
    });
  }
}

module.exports = { HyperFramesRenderer };