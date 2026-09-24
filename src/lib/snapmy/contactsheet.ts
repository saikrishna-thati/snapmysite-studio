// @ts-nocheck

/**
 * Contact Sheet Generator
 * 
 * Generates contact sheet images from storyboard for review
 */

class ContactSheetGenerator {
  constructor(options = {}) {
    this.outputDir = options.outputDir || './contact-sheets';
    this.width = options.width || 1920;
    this.height = options.height || 1080;
    this.columns = options.columns || 4;
  }

  async generate(storyboard, options = {}) {
    const contactSheetId = options.contactSheetId || `contact_sheet_${Date.now()}`;

    
    const shots = storyboard.shots || [];
    const rows = Math.ceil(shots.length / this.columns);
    
    // Generate contact sheet specification
    const spec = {
      contact_sheet_id: contactSheetId,
      output_path: contactSheetPath,
      dimensions: {
        width: this.width,
        height: this.height,
        columns: this.columns,
        rows: rows,
        cell_width: Math.floor((this.width - 40) / this.columns),
        cell_height: Math.floor((this.height - 80) / rows)
      },
      shots: this.generateShotSpecs(storyboard, rows),
      metadata: {
        generated: new Date().toISOString(),
        total_shots: shots.length,
        total_duration: storyboard.timing?.total_duration || 0,
        storyboard_version: storyboard.metadata?.version || "2.0"
      },
      special_shots: {
        continuous_shot: storyboard.continuous_shot,
        hero_frame: storyboard.hero_frame
      }
    };
    
    // Generate HTML contact sheet preview
    const htmlPreview = this.generateHTMLContactSheet(spec, contactSheetId);

    // Generate SVG contact sheet (vector format)
    const svgContactSheet = this.generateSVGContactSheet(spec, contactSheetId);

    return {
      contact_sheet_id: contactSheetId,
      specifications: spec,
      html_preview: htmlPreview,
      svg_output: svgContactSheet,
      shots_included: shots.length,
      dimensions: spec.dimensions
    };
  }

  generateShotSpecs(storyboard, rows) {
    const shots = storyboard.shots || [];
    const specs = [];
    
    for (let i = 0; i < shots.length; i++) {
      const shot = shots[i];
      const row = Math.floor(i / this.columns);
      const col = i % this.columns;
      
      specs.push({
        shot_index: shot.shot_index,
        type: shot.type,
        duration: shot.duration,
        camera_move: shot.camera_move?.move,
        position: {
          row: row,
          column: col,
          x: 20 + (col * ((this.width - 40) / this.columns)),
          y: 60 + (row * ((this.height - 80) / rows))
        },
        on_screen_copy: shot.on_screen_copy,
        sfx_cue: shot.sfx_cue,
        music_section: shot.music_section,
        evidence_asset: shot.evidence_asset,
        timestamp: shot.start_time,
        is_continuous: storyboard.continuous_shot?.shot_index === shot.shot_index,
        is_hero: storyboard.hero_frame?.shot_index === shot.shot_index
      });
    }
    
    return specs;
  }

  generateHTMLContactSheet(spec, contactSheetId) {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
    
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contact Sheet - ${contactSheetId}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #1e1e2e 0%, #2d2d3f 100%);
            color: #fff;
            min-height: 100vh;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            background: rgba(255,255,255,0.05);
            border-radius: 12px;
            backdrop-filter: blur(10px);
        }
        .header h1 {
            margin: 0 0 10px 0;
            font-size: 28px;
            background: linear-gradient(90deg, #3b82f6, #8b5cf6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .header .meta {
            color: #888;
            font-size: 14px;
        }
        .contact-sheet {
            display: grid;
            grid-template-columns: repeat(${this.columns}, 1fr);
            gap: 15px;
            margin-bottom: 30px;
        }
        .shot-cell {
            background: rgba(255,255,255,0.08);
            border-radius: 8px;
            overflow: hidden;
            border: 2px solid transparent;
            transition: all 0.3s ease;
        }
        .shot-cell:hover {
            transform: translateY(-5px);
            border-color: #3b82f6;
            box-shadow: 0 10px 30px rgba(59, 130, 246, 0.3);
        }
        .shot-cell.continuous {
            border-color: #10b981;
            box-shadow: 0 0 20px rgba(16, 185, 129, 0.2);
        }
        .shot-cell.hero {
            border-color: #f59e0b;
            box-shadow: 0 0 20px rgba(245, 158, 11, 0.2);
        }
        .shot-visual {
            height: 100px;
            background: linear-gradient(135deg, #3a3a4a 0%, #2a2a3a 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        }
        .shot-badge {
            position: absolute;
            top: 8px;
            left: 8px;
            background: rgba(0,0,0,0.7);
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
        }
        .shot-special {
            position: absolute;
            top: 8px;
            right: 8px;
            font-size: 12px;
        }
        .shot-info {
            padding: 12px;
        }
        .shot-type {
            font-weight: 600;
            font-size: 13px;
            margin-bottom: 6px;
            color: #fff;
        }
        .shot-details {
            font-size: 11px;
            color: #888;
            line-height: 1.4;
        }
        .shot-timing {
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid rgba(255,255,255,0.1);
            font-size: 10px;
            color: #666;
        }
        .summary {
            background: rgba(255,255,255,0.05);
            padding: 20px;
            border-radius: 12px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }
        .summary-item {
            text-align: center;
        }
        .summary-value {
            font-size: 24px;
            font-weight: bold;
            color: #3b82f6;
        }
        .summary-label {
            font-size: 12px;
            color: #888;
            margin-top: 5px;
        }
        .legend {
            display: flex;
            gap: 20px;
            justify-content: center;
            margin-top: 20px;
            padding: 15px;
            background: rgba(255,255,255,0.05);
            border-radius: 8px;
        }
        .legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
        }
        .legend-color {
            width: 16px;
            height: 16px;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 Storyboard Contact Sheet</h1>
            <div class="meta">
                ${contactSheetId} • ${spec.metadata.generated} • ${spec.metadata.total_shots} shots • ${spec.metadata.total_duration.toFixed(1)}s
            </div>
        </div>
        
        <div class="contact-sheet">`;
    
    for (const shot of spec.shots) {
      const color = colors[shot.shot_index % colors.length];
      const specialClass = shot.is_continuous ? 'continuous' : (shot.is_hero ? 'hero' : '');
      const specialBadge = shot.is_continuous ? '🎯 Continuous' : (shot.is_hero ? '⭐ Hero' : '');
      
      html += `
            <div class="shot-cell ${specialClass}">
                <div class="shot-visual" style="border-left: 4px solid ${color}">
                    <span class="shot-badge">#${shot.shot_index}</span>
                    ${specialBadge ? `<span class="shot-special">${specialBadge}</span>` : ''}
                    <span style="font-size: 28px; opacity: 0.3;">🎬</span>
                </div>
                <div class="shot-info">
                    <div class="shot-type">${shot.type}</div>
                    <div class="shot-details">
                        Duration: ${shot.duration}s<br>
                        Camera: ${shot.camera_move || 'static'}<br>
                        ${shot.on_screen_copy ? 'Copy: ' + shot.on_screen_copy.substring(0, 30) + '...' : ''}
                    </div>
                    <div class="shot-timing">
                        @${shot.timestamp.toFixed(1)}s • ${shot.sfx_cue} • ${shot.music_section}
                    </div>
                </div>
            </div>`;
    }
    
    html += `
        </div>
        
        <div class="summary">
            <div class="summary-item">
                <div class="summary-value">${spec.metadata.total_shots}</div>
                <div class="summary-label">Total Shots</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">${spec.metadata.total_duration.toFixed(1)}s</div>
                <div class="summary-label">Total Duration</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">${spec.special_shots.continuous_shot?.shot_index || 'N/A'}</div>
                <div class="summary-label">Continuous Shot</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">${spec.special_shots.hero_frame?.shot_index || 'N/A'}</div>
                <div class="summary-label">Hero Frame</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">${spec.dimensions.columns}×${spec.dimensions.rows}</div>
                <div class="summary-label">Grid Layout</div>
            </div>
        </div>
        
        <div class="legend">
            <div class="legend-item">
                <div class="legend-color" style="background: #10b981;"></div>
                <span>Continuous Shot (≥8s)</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #f59e0b;"></div>
                <span>Hero Frame (4-6s)</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background: #3b82f6;"></div>
                <span>Standard Shot</span>
            </div>
        </div>
    </div>
</body>
</html>`;
    
    return html;
  }

  generateSVGContactSheet(spec, contactSheetId) {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
    const cellWidth = spec.dimensions.cell_width;
    const cellHeight = spec.dimensions.cell_height;
    
    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${spec.dimensions.width}" height="${spec.dimensions.height}" viewBox="0 0 ${spec.dimensions.width} ${spec.dimensions.height}">
  <defs>
    <style>
      .shot-cell { fill: rgba(255,255,255,0.08); stroke: rgba(255,255,255,0.1); stroke-width: 1; }
      .shot-cell.continuous { stroke: #10b981; stroke-width: 2; }
      .shot-cell.hero { stroke: #f59e0b; stroke-width: 2; }
      .shot-type { font-family: Arial, sans-serif; font-size: 12px; font-weight: bold; fill: #fff; }
      .shot-details { font-family: Arial, sans-serif; font-size: 10px; fill: #888; }
      .shot-number { font-family: Arial, sans-serif; font-size: 10px; font-weight: bold; fill: #fff; }
      .header { font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; fill: #fff; }
      .meta { font-family: Arial, sans-serif; font-size: 12px; fill: #888; }
    </style>
  </defs>
  
  <!-- Background -->
  <rect width="100%" height="100%" fill="#1e1e2e"/>
  
  <!-- Header -->
  <text x="20" y="30" class="header">Storyboard Contact Sheet - ${contactSheetId}</text>
  <text x="20" y="50" class="meta">${spec.metadata.generated} • ${spec.metadata.total_shots} shots • ${spec.metadata.total_duration.toFixed(1)}s</text>`;
    
    for (const shot of spec.shots) {
      const color = colors[shot.shot_index % colors.length];
      const specialClass = shot.is_continuous ? 'continuous' : (shot.is_hero ? 'hero' : '');
      const x = shot.position.x;
      const y = shot.position.y;
      
      svg += `
  <!-- Shot ${shot.shot_index} -->
  <rect x="${x}" y="${y}" width="${cellWidth - 10}" height="${cellHeight - 10}" rx="4" class="shot-cell ${specialClass}"/>
  <rect x="${x}" y="${y}" width="4" height="${cellHeight - 10}" rx="0" fill="${color}"/>
  <text x="${x + 10}" y="${y + 15}" class="shot-number">#${shot.shot_index}</text>
  <text x="${x + 10}" y="${y + 35}" class="shot-type">${shot.type}</text>
  <text x="${x + 10}" y="${y + 50}" class="shot-details">${shot.duration}s • ${shot.camera_move || 'static'}</text>
  ${shot.is_continuous ? `<text x="${x + cellWidth - 50}" y="${y + 15}" class="shot-details" fill="#10b981">🎯</text>` : ''}
  ${shot.is_hero ? `<text x="${x + cellWidth - 50}" y="${y + 15}" class="shot-details" fill="#f59e0b">⭐</text>` : ''}`;
    }
    
    svg += `
</svg>`;
    
    return svg;
  }
}

export { ContactSheetGenerator };
