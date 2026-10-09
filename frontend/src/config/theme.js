export const C = {
  bg:      "#ffffff", panel:  "#f8f9fa", border: "#dfe3ea",
  accent:  "#0000ff", text:   "#1a2233", muted:  "#667085",
  temoin:  "#2d9a2d", expose: "#cc3333", green:  "#2d9a2d",
  orange:  "#ff9900", normal: "#0066cc", abnorm: "#cc3333",
  purple:  "#800080", teal:   "#008080",
};

export const FEAT_LABELS = {
  // Vitesse et Accélération
  vitesse_min:"Vitesse min. (m/s)", vitesse_max:"Vitesse max. (m/s)",
  vitesse_moy:"Vitesse moy. (m/s)", vitesse_std:"Vitesse σ (m/s)", stabilite:"Stabilité",
  acc_rms:"Accél. RMS (m/s²)",
  // Cinématique scalaire
  dvdt_moy:"accélération moyenne (m/s²)", dvdt_std:"accélération σ (m/s²)",
  jerk_max:"Jerk max. (m/s³)", jerk_moy:"Jerk moyen (m/s³)",
  // Géométrie et Trajectoire
  sinuosity:"Sinuosité", dist_totale:"Dist. totale (m)",
  msd_mean:"MSD moyen (m²)",
  rayon_giration:"Rayon giration (m)", aire:"Aire convexe (m²)", z_std:"Variance Z (m)",
  // Angles et direction
  entropie_angles:"Entropie angulaire circ. (bits)", autocorr_dir:"Autocorr. dir. circulaire",
  elevation_moy:"Angle d'élévation moy. (rad)", elevation_std:"Angle d'élévation σ (rad)",
  angular_vel_moy:"Vit. angulaire moy. (rad/s)", angular_vel_max:"Vit. angulaire max. (rad/s)",
  // Immobilité / Bouts
  taux_immobilite:"Taux immobilité",
  temps_jusqua_immobilite:"Temps jusqu'à immob. (s)", ratio_mouvement_arret:"Ratio mvt/arrêt (%)",
  nb_bouts:"Nb bouts",
  // Spatial
  dist_ruche_mean:"Dist. ruche moy. (m)", corr_xy_z:"Corr. XY-Z",
  confusion_spatiale:"Confusion spatiale",
  // Altitude
  altitude_moy:"Altitude moy. (m)", altitude_min:"Altitude min. (m)", altitude_max:"Altitude max. (m)",
  // Interactions fleurs
  nb_visites_plantes:"Nb plantes visitées",
  nb_fleurs_distinctes_visitees:"Nb fleurs distinctes visitées",
  time_to_first_visit:"Time to first visit (s)",
  temps_proche_plantes:"Tps près plantes (s)",
  dwell_moy_par_fleur:"Dwell moy./fleur (s)", transitions_fleurs:"Transitions fleurs",
  temps_inter_visites_moy:"Tps inter-visites moyen (s)",
  latence_florale_moy:"Latence florale (s)",
  // Comportement
  indice_grooming:"Indice grooming",
  // Efficacité et Temps
  path_efficiency:"Efficacité vol",
  temps_total_vol:"Durée totale vol (s)", retour_ruche:"Retour ruche",
};

export const css = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{color:${C.text};font-family:'Segoe UI',system-ui,-apple-system,sans-serif;font-size:13px}
  ::-webkit-scrollbar{width:5px;height:5px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:rgba(102,112,133,.35);border-radius:3px}
  ::-webkit-scrollbar-thumb:hover{background:rgba(102,112,133,.55)}

  @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  @keyframes shimmer{from{background-position:200% 0}to{background-position:-200% 0}}

  .app{display:grid;grid-template-rows:auto 1fr;height:100%;overflow:hidden;position:relative;animation:fadeUp .45s ease}
  .hdr{background:linear-gradient(90deg,rgba(255,255,255,.95),rgba(244,247,251,.9));backdrop-filter:blur(14px);border-bottom:1px solid ${C.border};display:flex;align-items:center;padding:8px 16px;gap:14px;flex-wrap:wrap}
  .hdr-logo{font-size:19px;font-weight:800;letter-spacing:.5px;color:${C.text}}
  .hdr-badge{font-size:11px;padding:2px 8px;border-radius:10px;background:rgba(0,102,204,.1);border:1px solid rgba(0,102,204,.3);color:${C.accent};font-weight:600}

  .kpi{display:flex;flex-direction:column;align-items:center;padding:3px 12px;border-radius:10px;
    background:rgba(102,112,133,.08);border:1px solid ${C.border};min-width:64px;transition:all .2s;cursor:default}
  .kpi:hover{background:rgba(0,102,204,.1);border-color:rgba(0,102,204,.45);transform:translateY(-2px)}
  .kpi-num{font-size:16px;font-weight:800;color:${C.accent};font-variant-numeric:tabular-nums;line-height:1.2}
  .kpi-lbl{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${C.muted}}

  .main{display:grid;grid-template-columns:246px 1fr;overflow:hidden}
  .side{background:rgba(255,255,255,.92);backdrop-filter:blur(14px);border-right:1px solid ${C.border};overflow-y:auto;display:flex;flex-direction:column}
  .sec{border-bottom:1px solid ${C.border};padding:10px 12px}
  .sec-title{font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${C.muted};margin-bottom:8px}

  .bee-item{display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:6px;cursor:pointer;border:1px solid transparent;transition:all .12s}
  .bee-item:hover{background:rgba(0,102,204,.1);transform:translateX(2px)}
  .bee-item.sel{background:rgba(0,102,204,.16);border-color:rgba(0,102,204,.5)}

  .center{display:flex;flex-direction:column;overflow:hidden;background:#fff}
  .tabs{display:flex;border-bottom:1px solid ${C.border};background:#f8f9fa;overflow-x:auto;flex-shrink:0;padding:4px 8px;gap:4px}
  .tab{padding:7px 14px;font-size:13px;cursor:pointer;border-radius:8px;color:${C.muted};font-weight:600;letter-spacing:.3px;white-space:nowrap;flex-shrink:0;transition:all .18s;border:1px solid transparent}
  .tab:hover{color:${C.text};background:rgba(102,112,133,.1)}
  .tab.on{color:#fff;background:linear-gradient(135deg,#0066cc,#6b3db8);border-color:rgba(0,0,0,.05);box-shadow:0 2px 12px rgba(0,102,204,.35)}
  .cvs-wrap{flex:1;position:relative;overflow:hidden;min-height:0}
  .cvs-wrap canvas{position:absolute;top:0;left:0;width:100%;height:100%}

  .sr{display:flex;justify-content:space-between;align-items:baseline;padding:4px 0;border-bottom:1px solid ${C.border}22}
  .sl{color:${C.muted};font-size:12px}
  .sv{font-size:12px;font-weight:600;font-variant-numeric:tabular-nums}
  .no-data{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:${C.muted};gap:8px;text-align:center;padding:32px}
  .chip{font-size:12px;padding:1px 6px;border-radius:8px;font-weight:600;display:inline-flex;align-items:center}

  .btn-grp{display:flex;gap:4px;flex-wrap:wrap}
  .btn{font-size:12px;padding:4px 10px;border-radius:7px;cursor:pointer;font-weight:600;border:1px solid ${C.border};background:rgba(102,112,133,.06);color:${C.text};transition:all .15s}
  .btn:hover{border-color:rgba(0,102,204,.5);color:${C.accent};background:rgba(0,102,204,.07);transform:translateY(-1px)}
  .btn.on{border-color:rgba(0,102,204,.7);background:rgba(0,102,204,.14);color:${C.accent};box-shadow:0 0 8px rgba(0,102,204,.2)}
  .btn:disabled{opacity:.35;cursor:not-allowed;transform:none}

  .tbl{width:100%;border-collapse:collapse;font-size:12px}
  .tbl th{text-align:left;padding:5px 6px;border-bottom:1px solid ${C.border};font-size:11px;color:${C.muted};text-transform:uppercase;letter-spacing:1px}
  .tbl td{padding:4px 6px;border-bottom:1px solid ${C.border}22;font-variant-numeric:tabular-nums}
  .tbl tr:hover td{background:rgba(0,102,204,.06)}

  .shap-bar-pos{background:${C.expose};opacity:.85;border-radius:1px;position:absolute;left:50%;height:100%}
  .shap-bar-neg{background:${C.normal};opacity:.85;border-radius:1px;position:absolute;right:50%;height:100%}

  .metric-card{background:#fff;border:1px solid ${C.border};border-radius:10px;padding:10px;margin-bottom:8px;transition:all .2s;animation:fadeUp .4s ease backwards;box-shadow:0 1px 4px rgba(16,24,40,.05)}
  .metric-card:hover{border-color:rgba(0,102,204,.4);transform:translateY(-2px);box-shadow:0 6px 20px rgba(16,24,40,.1)}
  .metric-row{display:flex;align-items:center;gap:8px;margin-bottom:4px}
  .progress-track{flex:1;height:8px;background:rgba(102,112,133,.12);border-radius:4px;overflow:hidden;position:relative}
  .stacked-bar{height:32px;background:rgba(102,112,133,.1);border-radius:8px;display:flex;border:1px solid ${C.border};overflow:hidden;margin-bottom:8px}
  .stacked-segment{display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;transition:flex .15s}
`;
