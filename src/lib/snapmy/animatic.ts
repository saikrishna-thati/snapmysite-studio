// @ts-nocheck

const PRODUCT_BEATS = new Set(["screen", "scroll", "split", "flyin", "depthReveal", "matchcut", "track"]);

/**
 * Animatic Renderer
 * 
 * Renders low-res preview versions of the storyboard using grey boxes and real screenshots
 * for review before building the full film.
 */

class AnimaticRenderer {
  constructor(options = {}) {
    this.outputDir = options.outputDir || './animatics';
    this.resolution = options.resolution || { width: 640, height: 360 }; // Low-res 16:9
    this.fps = options.fps || 30;
    this.includeScreenshots = options.includeScreenshots !== false;
  }

  async renderStoryboard(storyboard, options = {}) {
    const animaticId = options.animaticId || `animatic_${Date.now()}`;

    const shots = storyboard.shots || [];
    const totalDuration = storyboard.timing?.total_duration || 30;
    const totalFrames = Math.ceil(totalDuration * this.fps);

    // Generate frame-by-frame rendering plan
    const renderPlan = this.generateRenderPlan(storyboard, totalFrames);

    // Generate frame specifications (without actual rendering - that would require FFmpeg/Canvas)
    const frameSpecs = this.generateFrameSpecs(renderPlan, storyboard);

    // Generate HTML animatic preview
    const htmlPreview = this.generateHTMLPreview(storyboard, frameSpecs, animaticId);

    // Generate contact sheet
    const contactSheet = this.generateContactSheetSpec(storyboard);

    return {
      animatic_id: animaticId,
      total_frames: totalFrames,
      total_duration: totalDuration,
      resolution: this.resolution,
      fps: this.fps,
      shots_processed: shots.length,
      render_plan: renderPlan,
      frame_specs: frameSpecs,
      html_preview: htmlPreview,
      contact_sheet: contactSheet,
      preview_available: true,
      contact_sheet_available: true
    };
  }

  generateRenderPlan(storyboard, totalFrames) {
    const shots = storyboard.shots || [];
    const plan = {
      total_frames: totalFrames,
      fps: this.fps,
      resolution: this.resolution,
      shots: []
    };
    
    let currentFrame = 0;
    
    for (const shot of shots) {
      const shotFrames = Math.ceil(shot.duration * this.fps);
      const shotPlan = {
        shot_index: shot.shot_index,
        type: shot.type,
        start_frame: currentFrame,
        end_frame: currentFrame + shotFrames - 1,
        duration: shot.duration,
        camera_move: shot.camera_move,
        evidence_asset: shot.evidence_asset,
        on_screen_copy: shot.on_screen_copy,
        sfx_cue: shot.sfx_cue,
        music_section: shot.music_section,
        transition: shot.transition,
        elements: this.generateShotElements(shot, storyboard)
      };
      
      plan.shots.push(shotPlan);
      currentFrame += shotFrames;
    }
    
    return plan;
  }

  generateShotElements(shot, storyboard) {
    const elements = [];
    
    // Add grey box placeholder for UI
    elements.push({
      type: 'grey_box',
      position: { x: 0.1, y: 0.1, width: 0.8, height: 0.6 },
      opacity: 0.3,
      label: shot.type
    });
    
    // Add screenshot if available
    if (shot.evidence_asset && this.includeScreenshots) {
      const asset = storyboard.evidence_assets?.find(a => a.asset_id === shot.evidence_asset);
      if (asset) {
        elements.push({
          type: 'screenshot',
          asset_id: shot.evidence_asset,
          position: { x: 0.1, y: 0.1, width: 0.8, height: 0.6 },
          crop: asset.crop || 'full',
          opacity: 0.8
        });
      }
    }
    
    // Add on-screen copy
    if (shot.on_screen_copy) {
      elements.push({
        type: 'text',
        content: shot.on_screen_copy,
        position: { x: 0.5, y: 0.8 },
        animation: 'fade-in',
        duration: 0.5
      });
    }
    
    // Add cursor action if applicable
    const cursorAction = storyboard.cursor_actions?.find(c => c.shot_index === shot.shot_index);
    if (cursorAction) {
      elements.push({
        type: 'cursor',
        action: cursorAction.action,
        target: cursorAction.target_element,
        path: cursorAction.bezier_path,
        timing: cursorAction.timing
      });
    }
    
    return elements;
  }

  generateFrameSpecs(renderPlan, storyboard) {
    const specs = {
      total_frames: renderPlan.total_frames,
      frames: []
    };
    
    for (let frame = 0; frame < renderPlan.total_frames; frame++) {
      const shot = renderPlan.shots.find(s => 
        frame >= s.start_frame && frame <= s.end_frame
      );
      
      if (shot) {
        const progress = (frame - shot.start_frame) / (shot.end_frame - shot.start_frame);
        specs.frames.push({
          frame_number: frame,
          shot_index: shot.shot_index,
          progress: progress,
          elements: this.interpolateElements(shot.elements, progress, shot.camera_move)
        });
      }
    }
    
    return specs;
  }

  interpolateElements(elements, progress, cameraMove) {
    return elements.map(element => {
      if (element.type === 'grey_box' || element.type === 'screenshot') {
        // Apply camera move interpolation
        const interpolated = { ...element };
        
        if (cameraMove?.move === 'push') {
          const scale = 1 + (progress * 0.1);
          interpolated.position = {
            x: element.position.x - (progress * 0.02),
            y: element.position.y - (progress * 0.02),
            width: element.position.width * scale,
            height: element.position.height * scale
          };
        } else if (cameraMove?.move === 'track') {
          interpolated.position = {
            x: element.position.x - (progress * 0.05),
            y: element.position.y,
            width: element.position.width,
            height: element.position.height
          };
        }
        
        return interpolated;
      }
      return element;
    });
  }

  generateHTMLPreview(storyboard, frameSpecs, animaticId) {
    const shots = storyboard.shots || [];
    
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Animatic Preview - ${animaticId}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background: #1a1a1a;
            color: #fff;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid #333;
        }
        .shot-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }
        .shot-card {
            background: #2a2a2a;
            border-radius: 8px;
            overflow: hidden;
            border: 1px solid #333;
        }
        .shot-visual {
            height: 120px;
            background: linear-gradient(135deg, #3a3a3a 0%, #2a2a2a 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        }
        .shot-visual .label {
            position: absolute;
            top: 5px;
            left: 5px;
            background: rgba(0,0,0,0.7);
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
        }
        .shot-info {
            padding: 10px;
        }
        .shot-type {
            font-weight: bold;
            font-size: 12px;
            margin-bottom: 5px;
        }
        .shot-details {
            font-size: 10px;
            color: #888;
        }
        .timing-bar {
            margin-top: 15px;
            height: 20px;
            background: #333;
            border-radius: 10px;
            overflow: hidden;
        }
        .timing-segment {
            height: 100%;
            display: inline-block;
        }
        .metadata {
            background: #2a2a2a;
            padding: 15px;
            border-radius: 8px;
            margin-top: 20px;
        }
        .metadata-item {
            margin-bottom: 8px;
            font-size: 12px;
        }
        .metadata-label {
            color: #888;
            margin-right: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Animatic Preview: ${animaticId}</h1>
            <p>Low-resolution storyboard preview for review</p>
        </div>
        
        <div class="shot-grid">`;
    
    let currentTime = 0;
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    
    for (const shot of shots) {
      const color = colors[shot.shot_index % colors.length];
      html += `
            <div class="shot-card">
                <div class="shot-visual" style="border-left: 4px solid ${color}">
                    <span class="label">#${shot.shot_index}</span>
                    <span style="font-size: 24px; opacity: 0.5;">🎬</span>
                </div>
                <div class="shot-info">
                    <div class="shot-type">${shot.type}</div>
                    <div class="shot-details">
                        Duration: ${shot.duration}s<br>
                        Camera: ${shot.camera_move?.move || 'static'}<br>
                        ${shot.evidence_asset ? 'Asset: ' + shot.evidence_asset : ''}
                    </div>
                </div>
            </div>`;
      currentTime += shot.duration;
    }
    
    html += `
        </div>
        
        <div class="timing-bar">`;
    
    currentTime = 0;
    for (const shot of shots) {
      const color = colors[shot.shot_index % colors.length];
      const width = (shot.duration / storyboard.timing.total_duration) * 100;
      html += `<span class="timing-segment" style="width: ${width}%; background: ${color};"></span>`;
      currentTime += shot.duration;
    }
    
    html += `
        </div>
        
        <div class="metadata">
            <div class="metadata-item">
                <span class="metadata-label">Total Duration:</span>
                ${storyboard.timing.total_duration}s
            </div>
            <div class="metadata-item">
                <span class="metadata-label">Total Shots:</span>
                ${shots.length}
            </div>
            <div class="metadata-item">
                <span class="metadata-label">Continuous Shot:</span>
                Shot #${storyboard.continuous_shot?.shot_index} (${storyboard.continuous_shot?.duration}s)
            </div>
            <div class="metadata-item">
                <span class="metadata-label">Hero Frame:</span>
                Shot #${storyboard.hero_frame?.shot_index} (${storyboard.hero_frame?.duration}s)
            </div>
            <div class="metadata-item">
                <span class="metadata-label">First Content:</span>
                ${storyboard.timing.first_content_time}s
            </div>
            <div class="metadata-item">
                <span class="metadata-label">Vision Enabled:</span>
                ${storyboard.metadata?.vision_enabled ? 'Yes' : 'No'}
            </div>
        </div>
    </div>
</body>
</html>`;
    
    return html;
  }

  generateContactSheetSpec(storyboard) {
    const shots = storyboard.shots || [];
    const contactSheet = {
      title: 'Storyboard Contact Sheet',
      generated: new Date().toISOString(),
      layout: {
        columns: 4,
        rows: Math.ceil(shots.length / 4),
        cell_width: 320,
        cell_height: 180
      },
      shots: shots.map(shot => ({
        shot_index: shot.shot_index,
        type: shot.type,
        duration: shot.duration,
        camera_move: shot.camera_move?.move,
        on_screen_copy: shot.on_screen_copy,
        sfx_cue: shot.sfx_cue,
        music_section: shot.music_section,
        timestamp: shot.start_time
      })),
      timing_summary: storyboard.timing,
      special_shots: {
        continuous_shot: storyboard.continuous_shot,
        hero_frame: storyboard.hero_frame
      }
    };
    
    return contactSheet;
  }
}

export { AnimaticRenderer };
