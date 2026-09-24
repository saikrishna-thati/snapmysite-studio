// Subagents 7 & 10: The 100-Transition Motion Matrix & One-Click Remix Engine

export const TRANSITION_MATRIX_100 = {
  // Category 1: 3D Camera & Dolly (15)
  camera_dolly: [
    'dolly_zoom_in', 'dolly_zoom_out', 'orbit_snap_90', 'crane_tilt_up', 'crane_tilt_down',
    'subtle_drift_pan_left', 'subtle_drift_pan_right', 'spiral_vortex_dive', 'infinite_z_tunnel',
    'fps_truck_right', 'fps_truck_left', 'isometric_elevation_snap', 'whip_pan_3d_horizontal',
    'whip_pan_3d_vertical', 'dutch_angle_barrel_roll'
  ],

  // Category 2: Dynamic Wipes & Slices (15)
  wipes_slices: [
    'diagonal_split_wipe', 'multi_band_accordion', 'radial_clock_mask', 'curtain_reveal_left',
    'curtain_reveal_right', 'venetian_blinds_3d', 'angular_blade_slice', 'chevron_sweep_right',
    'chevron_sweep_left', 'iris_circle_expand', 'diamond_aperture_zoom', 'starburst_reveal',
    'horizontal_shutter_bars', 'vertical_barcode_scan', 'matrix_rain_wipe'
  ],

  // Category 3: Warps & Distortions (15)
  warps_distortions: [
    'optical_lens_warp', 'barrel_distortion_snap', 'liquid_ripple_displace', 'chromatic_prism_shift',
    'magnetic_attractor_pull', 'pixel_shatter_implode', 'black_hole_singularity', 'hyperspace_streak',
    'fisheye_bulge_expand', 'pinch_deflect_wave', 'heatwave_refraction_shimmer', 'turbulent_smoke_dissolve',
    'vortex_twirl_sink', 'kaleidoscope_facet_turn', 'water_droplet_splash'
  ],

  // Category 4: Kinetic Typography Cuts (12)
  kinetic_typography: [
    'word_slam_zoom', 'marquee_velocity_cut', 'staggered_letter_mask', 'typographic_wipe',
    'headline_collision_split', 'letterbox_cinematic_snap', 'monospaced_code_stream',
    'font_weight_boldness_burst', 'kerning_expansion_reveal', 'tracking_collapse_jump',
    'subline_slide_up_hold', 'accent_keyword_highlight_pop'
  ],

  // Category 5: Seamless Match-Cuts (12)
  match_cuts: [
    'button_to_hero_expand', 'card_to_fullscreen_morph', 'color_palette_flood', 'shape_continuity_pivot',
    'isometric_box_flip', 'search_bar_to_modal_grow', 'logo_to_badge_scale', 'toggle_switch_state_morph',
    'input_field_focus_bloom', 'tag_pill_color_burst', 'icon_geometry_align', 'cursor_click_impact_expand'
  ],

  // Category 6: Glitch & Digital Signal (11)
  glitch_signal: [
    'scanline_roll_down', 'rgb_split_dropout', 'matrix_tile_reorder', 'digital_static_flash',
    'interlace_flicker_cut', 'vcr_tracking_jitter', 'datamosh_pixel_drag', 'compression_artifact_bloom',
    'analog_crt_power_off', 'binary_bit_flip_burst', 'signal_loss_white_noise'
  ],

  // Category 7: Atmospheric & Glass (10)
  atmospheric_glass: [
    'frosted_glass_dissolve', 'caustics_light_leak', 'smoke_veil_reveal', 'bloom_overexposure_cut',
    'diffused_depth_pull', 'anamorphic_lens_flare', 'godray_sunbeam_sweep', 'morning_dew_mist_fade',
    'soft_specular_streak', 'cinematic_bokeh_blur'
  ],

  // Category 8: Morph & Spatial Folding (10)
  morph_folding: [
    'origami_plane_fold', 'cube_facet_turn', 'isometric_book_flip', 'nested_window_pop',
    'elastic_bubble_morph', 'paper_curl_page_turn', '3d_card_shuffle', 'accordion_panel_compress',
    'origami_crane_unfold', 'spatial_depth_drawer_slide'
  ]
};

// Flattened 100 transitions list
export const ALL_100_TRANSITIONS = Object.values(TRANSITION_MATRIX_100).flat();

// Subagent 10: One-Click Remix Engine
export function generateRemixVariation(filmScript, seed = Date.now()) {
  const prng = (offset) => {
    const x = Math.sin(seed + offset) * 10000;
    return x - Math.floor(x);
  };

  const categories = Object.keys(TRANSITION_MATRIX_100);
  const remixedScenes = (filmScript?.film?.scenes || []).map((scene, i) => {
    const cat = categories[Math.floor(prng(i * 13) * categories.length)];
    const list = TRANSITION_MATRIX_100[cat];
    const pickedTransition = list[Math.floor(prng(i * 17) * list.length)];

    return {
      ...scene,
      transitionOut: pickedTransition,
      duration: Math.round((scene.duration + (prng(i * 7) - 0.5) * 0.8) * 10) / 10,
      camera: {
        ...scene.camera,
        target: {
          x: Math.round(scene.camera.target.x * (1 + (prng(i * 3) - 0.5) * 0.4)),
          y: Math.round(scene.camera.target.y * (1 + (prng(i * 5) - 0.5) * 0.4)),
          z: Math.round(scene.camera.target.z * (1 + (prng(i * 2) - 0.5) * 0.2)),
          pitch: Math.round(scene.camera.target.pitch + (prng(i * 11) - 0.5) * 10),
          yaw: Math.round(scene.camera.target.yaw + (prng(i * 9) - 0.5) * 14)
        }
      }
    };
  });

  return {
    ...filmScript,
    remixSeed: seed,
    film: {
      ...filmScript?.film,
      remixIteration: (filmScript?.film?.remixIteration || 0) + 1,
      scenes: remixedScenes
    }
  };
}
