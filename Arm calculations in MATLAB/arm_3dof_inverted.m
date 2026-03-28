function arm_3dof_inverted()
% =========================================================
%  3-DOF Robotic Arm Visualiser  —  ceiling-mounted (inverted)
%  Joint 1 : Base azimuth (yaw around Z, from ceiling)
%  Joint 2 : Shoulder pitch
%  Joint 3 : Elbow pitch
%
%  Usage: Run arm_3dof_inverted, enter link lengths.
%         Use sliders to move each joint.
% =========================================================

    clc; clear; close all;

    %% --- User inputs ---
    fprintf('=== 3-DOF Inverted Arm Visualiser ===\n');
    fprintf('Arm hangs downward from a ceiling mount.\n');
    fprintf('Enter link lengths (any consistent unit, e.g. mm):\n\n');

    d1 = input('Ceiling height / pedestal (d1): ');
    a1 = input('Link 1 arm length         (a1): ');
    a2 = input('Link 2 arm length         (a2): ');
    a3 = input('Tool / end-effector       (a3): ');

    %% --- Figure ---
    fig = figure('Name', '3-DOF Inverted Arm', ...
                 'NumberTitle', 'off', ...
                 'Position', [100 80 920 680], ...
                 'Color', [0.15 0.15 0.18]);

    ax = axes('Parent', fig, ...
              'Position', [0.05 0.25 0.90 0.72], ...
              'Color',    [0.10 0.10 0.13], ...
              'XColor', [0.7 0.7 0.7], ...
              'YColor', [0.7 0.7 0.7], ...
              'ZColor', [0.7 0.7 0.7], ...
              'GridColor',  [0.35 0.35 0.35], ...
              'GridAlpha',  0.5);
    hold(ax,'on'); grid(ax,'on'); axis(ax,'equal');
    xlabel(ax,'X'); ylabel(ax,'Y'); zlabel(ax,'Z');
    title(ax, '3-DOF Inverted Arm  —  ceiling mounted', ...
          'Color',[0.9 0.9 0.9], 'FontSize', 12);
    view(ax, 45, 20);

    reach = a1 + a2 + a3;
    lim   = reach * 1.2;

    xlim(ax, [-lim  lim]);
    ylim(ax, [-lim  lim]);
    zlim(ax, [d1 - reach*1.15,  d1 + d1*0.25]);

    %% --- Sliders ---
    names  = {'Joint 1  (base azimuth)', ...
              'Joint 2  (shoulder)',     ...
              'Joint 3  (elbow)'};
    limits = [-180 180;
              -135 135;
              -135 135];
    inits  = [0, -45, 60];

    strip_cols = [0.30 0.60 0.95;
                  0.25 0.80 0.55;
                  0.95 0.65 0.25];

    sliders   = gobjects(3,1);
    val_texts = gobjects(3,1);

    for k = 1:3
        ypos = 0.215 - (k-1)*0.072;

        uicontrol('Style','frame', ...
            'Units','normalized', 'Position',[0.03 ypos 0.012 0.055], ...
            'BackgroundColor', strip_cols(k,:));

        uicontrol('Style','text', 'String', names{k}, ...
            'Units','normalized', 'Position',[0.048 ypos 0.175 0.055], ...
            'BackgroundColor',[0.15 0.15 0.18], ...
            'ForegroundColor',[0.85 0.85 0.85], ...
            'HorizontalAlignment','right', 'FontSize', 9);

        sliders(k) = uicontrol('Style','slider', ...
            'Units','normalized', 'Position',[0.235 ypos 0.610 0.055], ...
            'Min', limits(k,1), 'Max', limits(k,2), ...
            'Value', inits(k), ...
            'BackgroundColor', strip_cols(k,:) * 0.6);

        val_texts(k) = uicontrol('Style','text', ...
            'Units','normalized', 'Position',[0.855 ypos 0.115 0.055], ...
            'BackgroundColor',[0.15 0.15 0.18], ...
            'ForegroundColor',[0.45 0.80 0.55], ...
            'FontSize', 10, 'FontWeight','bold', ...
            'String', sprintf('%+.1f°', inits(k)));

        addlistener(sliders(k), 'Value', 'PostSet', @(~,~) update_arm());
    end

    update_arm();

    %% ======================================================
    %  Update function
    %% ======================================================
    function update_arm()

        az  = deg2rad(sliders(1).Value);
        th2 = deg2rad(sliders(2).Value);
        th3 = deg2rad(sliders(3).Value);

        for j = 1:3
            val_texts(j).String = sprintf('%+.1f°', sliders(j).Value);
        end

        % ---- Forward kinematics ----
        %
        % We build joint positions directly using direction vectors,
        % rather than DH transforms, so the downward default is exact.
        %
        % At rest (all angles = 0):
        %   - The arm hangs straight down from the ceiling mount.
        %   - Azimuth spins the whole arm around world Z.
        %   - Shoulder bends link 1 away from straight-down,
        %     rotating around the azimuth-perpendicular axis.
        %   - Elbow bends link 2 relative to link 1.

        p_mount = [0; 0; d1];

        % Azimuth: spin frame around world Z
        Raz = rot_z(az);

        % Neutral link direction is straight down: [0;0;-1]
        % Bending axis for shoulder is the azimuth-rotated X axis
        bend_ax1 = Raz * [1; 0; 0];

        % Shoulder rotation bends link 1 away from straight-down
        R_shoulder = rot_axis(bend_ax1, th2);
        dir1 = R_shoulder * [0; 0; -1];   % direction of link 1

        p1 = p_mount + a1 * dir1;

        % Elbow bending axis: perpendicular to dir1 in the current plane
        % Use the azimuth Y axis rotated to stay consistent with shoulder plane
        bend_ax2 = Raz * [0; 1; 0];
        % Re-orient to stay perpendicular to dir1
        bend_ax2 = cross(dir1, bend_ax2);
        if norm(bend_ax2) < 1e-9
            bend_ax2 = bend_ax1;
        else
            bend_ax2 = -bend_ax2 / norm(bend_ax2);
        end

        R_elbow = rot_axis(bend_ax2, th3);
        dir2 = R_elbow * dir1;   % direction of link 2

        p2   = p1 + a2 * dir2;
        p_ee = p2 + a3 * dir2;   % tool extends along link 2 direction

        % ---- Draw ----
        cla(ax);
        draw_ceiling(ax, d1, lim * 0.65);

        seg_colors = [0.30 0.60 0.95;
                      0.25 0.80 0.55;
                      0.95 0.65 0.25];

        base_r = 0.038 * reach;
        tube_r = [base_r, base_r*0.82, base_r*0.62];

        pts = [p_mount'; p1'; p2'; p_ee'];

        draw_tube(ax, pts(1,:), pts(2,:), tube_r(1), seg_colors(1,:));
        draw_tube(ax, pts(2,:), pts(3,:), tube_r(2), seg_colors(2,:));
        draw_tube(ax, pts(3,:), pts(4,:), tube_r(3), seg_colors(3,:));

        % Mount bracket stub into ceiling
        bracket_top = (p_mount + [0;0; d1*0.06])';
        draw_tube(ax, bracket_top, pts(1,:), base_r*1.5, [0.45 0.45 0.50]);

        % Ball joint sphere at ceiling mount
        draw_sphere(ax, pts(1,:), base_r*1.8, [0.55 0.55 0.65]);

        % Joint spheres
        draw_sphere(ax, pts(2,:), tube_r(1)*1.4, seg_colors(1,:));
        draw_sphere(ax, pts(3,:), tube_r(2)*1.4, seg_colors(2,:));

        % End-effector
        scatter3(ax, p_ee(1), p_ee(2), p_ee(3), 90, ...
                 [1 0.9 0.2], 'filled', 'MarkerEdgeColor','w');

        draw_reach_hemisphere(ax, d1, reach);

        view(ax, 45, 20);
        drawnow limitrate;
    end

end  % main


%% =========================================================
%  Rodrigues rotation around an arbitrary unit axis
%% =========================================================
function R = rot_axis(ax, angle)
    ax = ax / norm(ax);
    K  = [  0      -ax(3)   ax(2);
           ax(3)    0      -ax(1);
          -ax(2)   ax(1)    0   ];
    R  = eye(3) + sin(angle)*K + (1 - cos(angle))*(K*K);
end


%% =========================================================
%  Rotation around world Z
%% =========================================================
function R = rot_z(a)
    R = [cos(a) -sin(a) 0;
         sin(a)  cos(a) 0;
         0       0      1];
end


%% =========================================================
%  Cylinder tube between two 3-D points
%% =========================================================
function draw_tube(ax, p1, p2, r, col)
    n   = 16;
    p1  = p1(:)';
    p2  = p2(:)';
    len = norm(p2 - p1);
    if len < 1e-9; return; end

    th = linspace(0, 2*pi, n+1);
    xc = r * cos(th);
    yc = r * sin(th);

    [XC, ZC] = meshgrid(xc, [0; len]);
    [YC, ~]  = meshgrid(yc, [0; len]);

    zhat = (p2 - p1)' / len;
    if abs(zhat(3)) < 0.999
        xhat = cross([0;0;1], zhat); xhat = xhat/norm(xhat);
    else
        xhat = cross([1;0;0], zhat); xhat = xhat/norm(xhat);
    end
    yhat = cross(zhat, xhat);
    R    = [xhat, yhat, zhat];

    flat = R * [XC(:)'; YC(:)'; ZC(:)'];
    XW   = reshape(flat(1,:), 2, n+1) + p1(1);
    YW   = reshape(flat(2,:), 2, n+1) + p1(2);
    ZW   = reshape(flat(3,:), 2, n+1) + p1(3);

    surf(ax, XW, YW, ZW, ...
         'FaceColor', col, 'EdgeColor', 'none', ...
         'AmbientStrength', 0.4, 'DiffuseStrength', 0.7, ...
         'SpecularStrength', 0.5, 'FaceLighting', 'gouraud');
end


%% =========================================================
%  Sphere
%% =========================================================
function draw_sphere(ax, ctr, r, col)
    [xs, ys, zs] = sphere(18);
    surf(ax, xs*r+ctr(1), ys*r+ctr(2), zs*r+ctr(3), ...
         'FaceColor', col, 'EdgeColor', 'none', ...
         'AmbientStrength', 0.35, 'DiffuseStrength', 0.7, ...
         'SpecularStrength', 0.7, 'FaceLighting', 'gouraud');
end


%% =========================================================
%  Ceiling plate
%% =========================================================
function draw_ceiling(ax, height, half)
    fill3(ax, half*[-1 1 1 -1], half*[-1 -1 1 1], ...
          height*[1 1 1 1], ...
          [0.22 0.22 0.26], 'EdgeColor', [0.32 0.32 0.38]);
    for v = linspace(-half, half, 9)
        plot3(ax, [v v],        [-half half], height*[1 1], 'Color', [0.30 0.30 0.35]);
        plot3(ax, [-half half], [v v],        height*[1 1], 'Color', [0.30 0.30 0.35]);
    end
    % Faint floor for spatial reference
    fill3(ax, half*[-1 1 1 -1], half*[-1 -1 1 1], [0 0 0 0], ...
          [0.16 0.16 0.18], 'EdgeColor', [0.25 0.25 0.28], 'FaceAlpha', 0.4);

    light(ax, 'Position', [1 1 -2]*1e4, 'Style', 'infinite');
    light(ax, 'Position', [0 0  2]*1e4, 'Style', 'infinite');
end


%% =========================================================
%  Downward hemisphere  (reachable workspace hint)
%% =========================================================
function draw_reach_hemisphere(ax, ceiling_z, radius)
    [xs, ys, zs] = sphere(24);
    zs(zs > 0) = NaN;
    surf(ax, xs*radius, ys*radius, zs*radius + ceiling_z, ...
         'FaceColor', [0.4 0.6 0.9], 'FaceAlpha', 0.04, ...
         'EdgeColor', [0.5 0.5 0.6], 'EdgeAlpha', 0.10, ...
         'LineStyle', ':');
end
