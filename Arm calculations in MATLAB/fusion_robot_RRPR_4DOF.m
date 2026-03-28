% =========================================================================
% 4 DOF RRPR Ceiling-Mounted Robot Arm Simulation
% Configuration: Revolute (azimuth) + Revolute (shoulder) + 
%                Prismatic (telescoping) + Revolute (wrist rotation)
% For use inside a spherical tokamak vacuum vessel (STEP / SPP-002)
% =========================================================================
% REQUIREMENTS: Core MATLAB only (no toolbox required)
%               Optional: Peter Corke Robotics Toolbox for extended vis
%               https://github.com/petercorke/robotics-toolbox-matlab
%
% JOINT CONFIGURATION:
%   Joint 1 — Revolute  : Azimuth rotation about vertical Z axis (ceiling)
%   Joint 2 — Revolute  : Shoulder pitch — angles arm from vertical
%   Joint 3 — Prismatic : Telescoping extension along arm axis
%   Joint 4 — Revolute  : Wrist rotation — orients end effector tool
%
% IMPROVEMENT OVER 3 DOF:
%   The 4th joint (wrist rotation) gives you orientation control of the
%   end effector — critical for manipulation, component replacement, and
%   tool alignment tasks that the 3 DOF version could not achieve.
%
% END EFFECTOR OFFSET:
%   L4 represents the physical length of the wrist/tool assembly
%   mounted beyond Joint 4 (e.g. camera housing, gripper, sensor head)
% =========================================================================

clear; clc; close all;

%% =========================================================================
%  CONFIGURATION — SET YOUR DIMENSIONS HERE
% =========================================================================

% --- Vessel Geometry (STEP SPP-002 approximate reference dimensions) ---
vessel_height  = 15.0;   % [m] Internal height (floor to ceiling)
vessel_radius  = 1.25;    % [m] Usable radial width (outboard to central column)

% --- Link Lengths ---
L2         = 6.0;    % [m] Fixed shoulder link (Revolute joint 2)
L3_min     = 4.0;    % [m] Prismatic minimum extension (retracted)
L3_max     = 14.0;   % [m] Prismatic maximum extension (fully extended)
L4         = 0.4;    % [m] Wrist/tool assembly length beyond joint 4

% --- Joint Limits ---
q1_lim = [-pi,    pi   ];   % Joint 1: full azimuth ±180°
q2_lim = [0,      pi/2 ];   % Joint 2: shoulder 0–90°
q3_lim = [L3_min, L3_max];  % Joint 3: prismatic extension [m]
q4_lim = [-pi,    pi   ];   % Joint 4: wrist rotation ±180°

fprintf('=== STEP VESSEL DIMENSIONS ===\n');
fprintf('Internal height : %.1f m\n', vessel_height);
fprintf('Usable radius   : %.1f m\n\n', vessel_radius);
fprintf('=== RRPR ARM PARAMETERS ===\n');
fprintf('L2 (shoulder link)      : %.2f m (fixed)\n', L2);
fprintf('L3 (prismatic range)    : %.2f m — %.2f m\n', L3_min, L3_max);
fprintf('L4 (wrist/tool length)  : %.2f m\n', L4);
fprintf('Max reach (no wrist)    : %.2f m\n', L2 + L3_max);
fprintf('Max reach (with wrist)  : %.2f m\n\n', L2 + L3_max + L4);

%% =========================================================================
%  FORWARD KINEMATICS
%  RRPR arm — analytical solution
%
%  Joint variables:
%    q1 : azimuth angle [rad]
%    q2 : shoulder pitch [rad] (0 = straight down, pi/2 = horizontal)
%    q3 : prismatic extension [m]
%    q4 : wrist rotation [rad] (rotates tool about arm axis)
%
%  End-effector position (Z positive downward from ceiling):
%    The wrist rotation (q4) does not change end-effector XYZ position —
%    it controls tool orientation about the arm's longitudinal axis.
%    Position is identical to RRP arm + L4 offset along arm direction.
%
%    arm_dir = [sin(q2)*cos(q1); sin(q2)*sin(q1); cos(q2)]
%    pos_ee  = (L2 + q3 + L4) * arm_dir
% =========================================================================

function [pos, orientation] = fk_rrpr(q, L2, L4)
    % Forward kinematics for RRPR arm
    % q           : [q1, q2, q3, q4] joint variables
    % L2          : shoulder link length [m]
    % L4          : wrist/tool length [m]
    % pos         : [x,y,z] end-effector position (Z = depth below ceiling)
    % orientation : wrist rotation angle [rad] (q4, about arm axis)
    q1 = q(1); q2 = q(2); q3 = q(3); q4 = q(4);

    % Arm direction unit vector
    arm_dir = [sin(q2)*cos(q1);
               sin(q2)*sin(q1);
               cos(q2)];

    % End-effector position (L4 extends beyond prismatic joint)
    total = L2 + q3 + L4;
    pos   = total * arm_dir;

    % Orientation — wrist rotation about arm axis
    orientation = q4;
end

%% =========================================================================
%  INVERSE KINEMATICS
%  RRPR arm — closed-form analytical solution
%
%  Position IK (identical to RRP, accounting for L4 offset):
%    q1 = atan2(y, x)
%    total_reach = norm([x,y,z]) 
%    q2 = acos(z / total_reach)
%    q3 = total_reach - L2 - L4
%
%  Orientation IK:
%    q4 = desired_wrist_angle (set independently by task requirement)
% =========================================================================

function [q, valid] = ik_rrpr(target, desired_wrist, L2, L4, q1_lim, q2_lim, q3_lim, q4_lim)
    % Inverse kinematics for RRPR arm
    % target        : [x,y,z] desired end-effector position
    % desired_wrist : desired wrist rotation angle [rad]
    x = target(1); y = target(2); z = target(3);

    q1 = atan2(y, x);
    total_reach = sqrt(x^2 + y^2 + z^2);

    if total_reach < 1e-6
        q = [0, 0, q3_lim(1), 0]; valid = false; return;
    end

    q2 = acos(min(max(z / total_reach, -1), 1));
    q3 = total_reach - L2 - L4;   % account for wrist tool length
    q4 = desired_wrist;

    % Check joint limits
    valid = (q1 >= q1_lim(1) && q1 <= q1_lim(2)) && ...
            (q2 >= q2_lim(1) && q2 <= q2_lim(2)) && ...
            (q3 >= q3_lim(1) && q3 <= q3_lim(2)) && ...
            (q4 >= q4_lim(1) && q4 <= q4_lim(2));

    q = [q1, q2, q3, q4];
end

%% =========================================================================
%  WORKSPACE ANALYSIS — Monte Carlo sampling
% =========================================================================

fprintf('Computing workspace (Monte Carlo sampling)...\n');
n_samples    = 80000;
reach_points = zeros(n_samples, 3);
valid_mask   = false(n_samples, 1);

for i = 1:n_samples
    q_rand = [q1_lim(1) + rand * diff(q1_lim), ...
              q2_lim(1) + rand * diff(q2_lim), ...
              q3_lim(1) + rand * diff(q3_lim), ...
              q4_lim(1) + rand * diff(q4_lim)];
    [pos, ~] = fk_rrpr(q_rand, L2, L4);
    reach_points(i,:) = pos';

    r_pos = sqrt(pos(1)^2 + pos(2)^2);
    valid_mask(i) = (r_pos <= vessel_radius) && ...
                    (pos(3) >= 0) && (pos(3) <= vessel_height);
end

coverage = 100 * sum(valid_mask) / n_samples;
fprintf('Workspace computed. Vessel coverage: %.1f%%\n\n', coverage);

%% =========================================================================
%  IK VALIDATION — Key target points with wrist orientations
% =========================================================================

fprintf('=== IK VALIDATION — KEY TARGET POINTS ===\n');

test_targets = {
    [0,                0,              vessel_height*0.95], 0,       'Floor centre         (wrist 0°)';
    [vessel_radius*0.5, 0,             vessel_height*0.95], pi/4,   'Floor mid-radius     (wrist 45°)';
    [vessel_radius*0.8, 0,             vessel_height*0.50], pi/2,   'Wall mid-height      (wrist 90°)';
    [0,                0,              vessel_height*0.30], -pi/4,  'Upper vessel centre  (wrist -45°)';
    [vessel_radius*0.6, 0,             vessel_height*0.70], pi,     'Lower wall region    (wrist 180°)';
};

for t = 1:size(test_targets,1)
    tgt   = test_targets{t,1};
    wrist = test_targets{t,2};
    label = test_targets{t,3};

    [q_sol, valid] = ik_rrpr(tgt', wrist, L2, L4, q1_lim, q2_lim, q3_lim, q4_lim);
    [pos_ach, ~]   = fk_rrpr(q_sol, L2, L4);
    err            = norm(pos_ach' - tgt);
    status         = 'REACHABLE'; if ~valid; status = 'OUT OF RANGE'; end

    fprintf('%-40s -> %s  (err: %.4fm)\n', label, status, err);
    fprintf('  q1=%6.1f° | q2=%5.1f° | q3=%5.2fm | q4=%6.1f°\n\n', ...
        rad2deg(q_sol(1)), rad2deg(q_sol(2)), q_sol(3), rad2deg(q_sol(4)));
end

%% =========================================================================
%  FIGURE 1: 3D ARM VISUALISATION
% =========================================================================

figure(1); clf;
set(gcf,'Name','Fig 1: RRPR Arm in STEP Vessel (3D)','Color',[0.10 0.10 0.13]);
ax = axes('Color',[0.10 0.10 0.13],'XColor','w','YColor','w','ZColor','w');
hold on; grid on; axis equal;

% Vessel outline
theta_c = linspace(0, 2*pi, 60);
for depth = linspace(0, vessel_height, 8)
    plot3(vessel_radius*cos(theta_c), vessel_radius*sin(theta_c), ...
        repmat(-depth,size(theta_c)), 'Color',[0.2 0.5 0.9 0.25],'LineWidth',0.8);
end
for ang = linspace(0,2*pi,12)
    plot3([vessel_radius*cos(ang), vessel_radius*cos(ang)], ...
          [vessel_radius*sin(ang), vessel_radius*sin(ang)], ...
          [0, -vessel_height],'Color',[0.2 0.5 0.9 0.15],'LineWidth',0.5);
end
plot3(vessel_radius*cos(theta_c), vessel_radius*sin(theta_c), ...
    repmat(-vessel_height,size(theta_c)),'Color',[0.2 0.5 0.9 0.7],'LineWidth',1.5);

% Draw 3 poses
poses = [
    0,      pi/5,  L3_min+(L3_max-L3_min)*0.55,  0;
    pi/2,   pi/6,  L3_min+(L3_max-L3_min)*0.40,  pi/3;
    pi*1.2, pi/4,  L3_min+(L3_max-L3_min)*0.75,  -pi/4;
];
colours_p = {[1.00 0.42 0.21],[0.02 0.84 0.63],[1.00 0.82 0.40]};  % orange, teal, yellow
labels_p  = {'Pose A','Pose B','Pose C'};

for p = 1:3
    q_p  = poses(p,:);
    adir = [sin(q_p(2))*cos(q_p(1)); sin(q_p(2))*sin(q_p(1)); cos(q_p(2))];

    p0 = [0;0;0];                          % ceiling mount
    p1 = L2 * adir;                        % end of shoulder link
    p2 = (L2 + q_p(3)) * adir;            % end of prismatic (joint 4 location)
    p3 = (L2 + q_p(3) + L4) * adir;      % end effector tip

    % Wrist perpendicular vector (for visual indicator)
    perp = cross(adir, [0;0;1]);
    if norm(perp) < 1e-6; perp = cross(adir,[1;0;0]); end
    perp = perp / norm(perp);
    wrist_tip = p3 + 0.3*(cos(q_p(4))*perp + sin(q_p(4))*cross(adir,perp));

    % Plot links
    plot3([p0(1) p1(1)],[p0(2) p1(2)],[p0(3) -p1(3)],...
        'Color',colours_p{p},'LineWidth',4);
    plot3([p1(1) p2(1)],[p1(2) p2(2)],[-p1(3) -p2(3)],...
        'Color',colours_p{p},'LineWidth',2.5,'LineStyle','--');
    plot3([p2(1) p3(1)],[p2(2) p3(2)],[-p2(3) -p3(3)],...
        'Color',colours_p{p},'LineWidth',3.5);

    % Wrist orientation indicator
    plot3([p3(1) wrist_tip(1)],[p3(2) wrist_tip(2)],[-p3(3) -wrist_tip(3)],...
        'Color','w','LineWidth',1.5,'LineStyle',':');

    % Joint markers
    scatter3(p0(1),p0(2),0,           100,'w','filled');
    scatter3(p1(1),p1(2),-p1(3),      80, 'o','filled','MarkerFaceColor',colours_p{p},'MarkerEdgeColor','none');
    scatter3(p2(1),p2(2),-p2(3),      80, 'o','filled','MarkerFaceColor',colours_p{p},'MarkerEdgeColor','none');
    scatter3(p3(1),p3(2),-p3(3),     120, 'd','filled','MarkerFaceColor',colours_p{p},'MarkerEdgeColor','none');
    text(p3(1)+0.15,p3(2)+0.15,-p3(3),labels_p{p},'Color',colours_p{p},'FontSize',9);
end

scatter3(0,0,0,200,'w','filled','Marker','^');
text(0.2,0.2,0.3,'Ceiling Mount','Color','w','FontSize',9);
text(-vessel_radius*0.9,-vessel_radius*0.9,-vessel_height*0.05,...
    'Dotted line = wrist orientation','Color',[0.7 0.7 0.7],'FontSize',8);

xlabel('X (m)','Color','w'); ylabel('Y (m)','Color','w');
zlabel('Depth below ceiling (m)','Color','w');
title('4 DOF RRPR Arm — STEP Vessel (3 Example Poses)','Color','w','FontSize',13);
zlim([-vessel_height*1.05, vessel_height*0.05]);
view(35,25);

%% =========================================================================
%  FIGURE 2: 2D WORKSPACE CROSS-SECTION
% =========================================================================

figure(2); clf;
set(gcf,'Name','Fig 2: Reachable Workspace — 2D Cross Section','Color',[0.10 0.10 0.13]);
ax2 = axes('Color',[0.10 0.10 0.13],'XColor','w','YColor','w');
hold on; grid on;

r_all = sqrt(reach_points(:,1).^2 + reach_points(:,2).^2);
z_all = reach_points(:,3);

scatter(r_all(~valid_mask), z_all(~valid_mask), 1,[0.35 0.35 0.35],...
    'filled','MarkerFaceAlpha',0.04);
scatter(r_all(valid_mask),  z_all(valid_mask),  1,[0.2 0.9 0.5],...
    'filled','MarkerFaceAlpha',0.18);

rectangle('Position',[0,0,vessel_radius,vessel_height],...
    'EdgeColor',[0.3 0.6 1.0],'LineWidth',2,'LineStyle','--');
yline(0,             'w--','Ceiling','LineWidth',1.5,...
    'LabelHorizontalAlignment','left','FontSize',9);
yline(vessel_height, 'r--','Floor',  'LineWidth',1.5,...
    'LabelHorizontalAlignment','left','FontSize',9);
xline(vessel_radius, 'y--','Vessel wall','LineWidth',1.5,...
    'LabelVerticalAlignment','bottom','FontSize',9);

xlabel('Radial distance from centre (m)','Color','w');
ylabel('Depth below ceiling (m)','Color','w');
title('Reachable Workspace — 2D Cross Section','Color','w','FontSize',13);
xlim([0, vessel_radius*1.3]); ylim([-vessel_height*0.1, vessel_height*1.15]);
set(ax2,'YDir','reverse');

text(0.1, vessel_height*0.92,...
    sprintf('Vessel coverage: %.1f%%', coverage),...
    'Color',[0.2 1.0 0.5],'FontSize',12,'FontWeight','bold');

%% =========================================================================
%  FIGURE 3: JOINT PROFILES — FLOOR RADIAL SWEEP
% =========================================================================

figure(3); clf;
set(gcf,'Name','Fig 3: Joint Profiles — Floor Radial Sweep','Color',[0.10 0.10 0.13]);

r_sweep  = linspace(0.1, vessel_radius*0.90, 50);
z_target = vessel_height * 0.95;
desired_wrist_sweep = pi/4;  % 45° wrist angle during sweep

q1p = zeros(1,50); q2p = zeros(1,50);
q3p = zeros(1,50); q4p = zeros(1,50);
reachable = false(1,50);

for k = 1:50
    [q_k, v_k] = ik_rrpr([r_sweep(k);0;z_target], desired_wrist_sweep, ...
        L2, L4, q1_lim, q2_lim, q3_lim, q4_lim);
    q1p(k)=rad2deg(q_k(1)); q2p(k)=rad2deg(q_k(2));
    q3p(k)=q_k(3);          q4p(k)=rad2deg(q_k(4));
    reachable(k) = v_k;
end

profiles      = {q1p, q2p, q3p, q4p};
subtitles     = {'J1 Azimuth (deg)','J2 Shoulder Pitch (deg)',...
                 'J3 Prismatic Extension (m)','J4 Wrist Rotation (deg)'};
colours_j     = {[1.00 0.42 0.21],[0.02 0.84 0.63],[1.00 0.82 0.40],[0.78 0.49 1.00]};  % orange, teal, yellow, purple
lims_j        = {rad2deg(q1_lim), rad2deg(q2_lim), q3_lim, rad2deg(q4_lim)};

for j = 1:4
    subplot(4,1,j);
    set(gca,'Color',[0.13 0.13 0.16],'XColor','w','YColor','w');
    hold on; grid on;
    plot(r_sweep(reachable),  profiles{j}(reachable),  'Color',colours_j{j},'LineWidth',2.5);
    plot(r_sweep(~reachable), profiles{j}(~reachable), 'Color','r','LineWidth',1.5,'LineStyle',':');
    yline(lims_j{j}(1),'--','Color',[1 0.3 0.3],'LineWidth',1,'Alpha',0.7);
    yline(lims_j{j}(2),'--','Color',[1 0.3 0.3],'LineWidth',1,'Alpha',0.7);
    ylabel(subtitles{j},'Color','w','FontSize',8);
    if j==4; xlabel('Radial distance from centre (m)','Color','w'); end
    if j==1
        title(sprintf('Floor Sweep (depth=%.1fm, wrist=%.0f°)',...
            z_target, rad2deg(desired_wrist_sweep)),'Color','w','FontSize',12);
    end
end

%% =========================================================================
%  FIGURE 4: WRIST ORIENTATION CAPABILITY MAP
%  Shows which vessel regions the wrist can reach with different orientations
% =========================================================================

figure(4); clf;
set(gcf,'Name','Fig 4: Wrist Orientation Capability Map','Color',[0.10 0.10 0.13]);

wrist_angles  = [0, pi/4, pi/2, pi];
wrist_labels  = {'0°','45°','90°','180°'};
colours_w     = {[1.00 0.42 0.21],[1.00 0.82 0.40],[0.02 0.84 0.63],[0.78 0.49 1.00]};  % orange, yellow, teal, purple

ax4 = axes('Color',[0.10 0.10 0.13],'XColor','w','YColor','w');
hold on; grid on;

r_test = linspace(0, vessel_radius*0.95, 30);
z_test = linspace(vessel_height*0.05, vessel_height*0.95, 30);

for w = 1:4
    r_reach_w = []; z_reach_w = [];
    for ri = 1:length(r_test)
        for zi = 1:length(z_test)
            [~, v] = ik_rrpr([r_test(ri);0;z_test(zi)], wrist_angles(w), ...
                L2, L4, q1_lim, q2_lim, q3_lim, q4_lim);
            if v
                r_reach_w(end+1) = r_test(ri);
                z_reach_w(end+1) = z_test(zi);
            end
        end
    end
    scatter(r_reach_w, z_reach_w, 20, 'o', 'filled', ...
        'MarkerFaceColor', colours_w{w}, 'MarkerEdgeColor', 'none', ...
        'MarkerFaceAlpha', 0.5, 'DisplayName', sprintf('Wrist %s', wrist_labels{w}));
end

rectangle('Position',[0,0,vessel_radius,vessel_height],...
    'EdgeColor',[0.5 0.7 1.0],'LineWidth',2,'LineStyle','--');
yline(0,             'w--','Ceiling','LineWidth',1.2,...
    'LabelHorizontalAlignment','left','FontSize',8);
yline(vessel_height, 'r--','Floor',  'LineWidth',1.2,...
    'LabelHorizontalAlignment','left','FontSize',8);
xline(vessel_radius, 'y--','Wall',   'LineWidth',1.2,...
    'LabelVerticalAlignment','bottom','FontSize',8);

xlabel('Radial distance from centre (m)','Color','w');
ylabel('Depth below ceiling (m)','Color','w');
title('Wrist Orientation Capability by Vessel Region','Color','w','FontSize',13);
set(ax4,'YDir','reverse');
xlim([0, vessel_radius*1.15]); ylim([-vessel_height*0.05, vessel_height*1.1]);
legend('TextColor','w','Color',[0.1 0.1 0.1],'Location','southeast','FontSize',9);

%% =========================================================================
%  FIGURE 5: TOP-DOWN COVERAGE HEATMAP
% =========================================================================

figure(5); clf;
set(gcf,'Name','Fig 5: Top-Down Coverage Heatmap','Color',[0.10 0.10 0.13]);
ax5 = axes('Color',[0.10 0.10 0.13],'XColor','w','YColor','w');
hold on; axis equal;

grid_res = 0.3;
x_edges  = -vessel_radius : grid_res : vessel_radius;
y_edges  = -vessel_radius : grid_res : vessel_radius;
[counts,~,~] = histcounts2(reach_points(valid_mask,1),...
                            reach_points(valid_mask,2), x_edges, y_edges);

imagesc(x_edges(1:end-1), y_edges(1:end-1), counts','AlphaData', counts'>0);
colormap(ax5, hot);
cb = colorbar; cb.Color = 'w';
cb.Label.String = 'Sample density (reach frequency)';
cb.Label.Color  = 'w';

plot(vessel_radius*cos(theta_c), vessel_radius*sin(theta_c),'w--','LineWidth',2);
scatter(0,0,150,'w','filled','Marker','^');
text(0.15,0.3,'Mount','Color','w','FontSize',9);

xlabel('X (m)','Color','w'); ylabel('Y (m)','Color','w');
title('Top-Down Workspace Coverage Heatmap','Color','w','FontSize',13);

%% =========================================================================
%  SUMMARY
% =========================================================================

fprintf('=== SUMMARY ===\n');
fprintf('Configuration       : RRPR (Revolute-Revolute-Prismatic-Revolute)\n');
fprintf('Vessel height       : %.1f m\n', vessel_height);
fprintf('Vessel radius       : %.1f m\n', vessel_radius);
fprintf('Shoulder link (L2)  : %.2f m\n', L2);
fprintf('Prismatic range (L3): %.2f — %.2f m\n', L3_min, L3_max);
fprintf('Wrist/tool (L4)     : %.2f m\n', L4);
fprintf('Vessel coverage     : %.1f%%\n', coverage);
fprintf('\nKey improvement over 3 DOF RRP:\n');
fprintf('  Joint 4 (wrist rotation) provides independent tool orientation\n');
fprintf('  control — enabling manipulation, alignment and component tasks.\n');
fprintf('\n=== 5 FIGURES GENERATED ===\n');
fprintf('Fig 1: 3D arm visualisation with wrist orientation indicators\n');
fprintf('Fig 2: 2D workspace cross-section\n');
fprintf('Fig 3: Joint profiles during floor radial sweep\n');
fprintf('Fig 4: Wrist orientation capability map by vessel region\n');
fprintf('Fig 5: Top-down coverage heatmap\n');
