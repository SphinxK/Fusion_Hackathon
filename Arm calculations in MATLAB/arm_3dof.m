% =========================================================
%  3-DOF Robotic Arm Visualiser
%  Usage: Run the script. Enter link lengths when prompted.
%         Use the sliders to control each joint angle.
% =========================================================

function arm_3dof()

    clc; clear; close all;

    %% --- User inputs: link dimensions ---
    fprintf('=== 3-DOF Arm Visualiser ===\n');
    fprintf('Enter link lengths (in your chosen unit, e.g. mm):\n\n');

    d1 = input('Base offset / link 1 height (d1): ');
    a1 = input('Link 1 arm length          (a1): ');
    a2 = input('Link 2 arm length          (a2): ');
    a3 = input('Tool / end-effector        (a3): ');

    %% --- Build the figure ---
    fig = figure('Name', '3-DOF Arm Visualiser', ...
                 'NumberTitle', 'off', ...
                 'Position', [100 100 900 600], ...
                 'Color', [0.15 0.15 0.18]);

    ax = axes('Parent', fig, ...
              'Position', [0.05 0.27 0.90 0.70], ...
              'Color',    [0.10 0.10 0.13], ...
              'XColor', [0.7 0.7 0.7], 'YColor', [0.7 0.7 0.7], 'ZColor', [0.7 0.7 0.7], ...
              'GridColor', [0.35 0.35 0.35], 'GridAlpha', 0.5);
    hold(ax, 'on'); grid(ax, 'on'); axis(ax, 'equal');
    xlabel(ax, 'X'); ylabel(ax, 'Y'); zlabel(ax, 'Z');
    title(ax, '3-DOF Arm  –  drag sliders to move joints', ...
          'Color', [0.9 0.9 0.9], 'FontSize', 12);
    view(ax, 45, 25);

    reach = d1 + a1 + a2 + a3;
    lim   = reach * 1.15;
    xlim(ax, [-lim  lim]);
    ylim(ax, [-lim  lim]);
    zlim(ax, [0     lim]);

    %% --- Sliders for joint angles ---
    joint_names  = {'Joint 1 (base yaw)', 'Joint 2 (shoulder)', 'Joint 3 (elbow)'};
    angle_limits = [-180 180; -90 90; -135 135];
    init_angles  = [0 45 -30];

    sliders   = gobjects(3,1);
    val_texts = gobjects(3,1);

    for k = 1:3
        ypos = 0.210 - (k-1)*0.068;

        uicontrol('Style','text', 'String', joint_names{k}, ...
            'Units','normalized', 'Position',[0.04 ypos 0.18 0.045], ...
            'BackgroundColor',[0.15 0.15 0.18], 'ForegroundColor',[0.85 0.85 0.85], ...
            'HorizontalAlignment','right', 'FontSize', 9);

        sliders(k) = uicontrol('Style','slider', ...
            'Units','normalized', 'Position',[0.23 ypos 0.60 0.045], ...
            'Min', angle_limits(k,1), 'Max', angle_limits(k,2), ...
            'Value', init_angles(k), ...
            'BackgroundColor', [0.25 0.45 0.75]);

        val_texts(k) = uicontrol('Style','text', ...
            'Units','normalized', 'Position',[0.85 ypos 0.10 0.045], ...
            'BackgroundColor',[0.15 0.15 0.18], 'ForegroundColor',[0.45 0.80 0.55], ...
            'FontSize', 10, 'FontWeight','bold', ...
            'String', sprintf('%+.1f°', init_angles(k)));

        addlistener(sliders(k), 'Value', 'PostSet', @(~,~) update_arm());
    end

    %% --- Initial draw ---
    update_arm();

    %% ======================================================
    %  Nested update function
    %% ======================================================
    function update_arm()

        theta = deg2rad([sliders(1).Value, sliders(2).Value, sliders(3).Value]);

        for j = 1:3
            val_texts(j).String = sprintf('%+.1f°', rad2deg(theta(j)));
        end

        % DH table: [theta, d, a, alpha]
        DH = [theta(1),  d1,  0,   pi/2;   % base yaw + vertical rise
              theta(2),  0,   a1,  0;       % shoulder
              theta(3),  0,   a2,  0];      % elbow

        T = eye(4);
        pts = zeros(5, 3);
        pts(1,:) = [0 0 0];

        for i = 1:3
            T = T * dh_matrix(DH(i,1), DH(i,2), DH(i,3), DH(i,4));
            pts(i+1,:) = T(1:3,4)';
        end

        % Tool tip
        T_tool  = T * dh_matrix(0, 0, a3, 0);
        pts(5,:) = T_tool(1:3,4)';

        % ---- Draw ----
        cla(ax);
        draw_ground(ax, lim*0.6);

        seg_colors = [0.30 0.60 0.95;   % link 1 – blue
                      0.25 0.80 0.55;   % link 2 – green
                      0.95 0.65 0.25];  % link 3 – amber

        tube_radii = [0.030 0.025 0.020] * reach;

        for i = 1:3
            draw_tube(ax, pts(i,:), pts(i+1,:), tube_radii(i), seg_colors(i,:));
        end

        % Tool
        draw_tube(ax, pts(4,:), pts(5,:), tube_radii(3)*0.6, [0.80 0.80 0.90]);

        % Joint spheres
        for i = 1:4
            draw_sphere(ax, pts(i,:), tube_radii(min(i,3))*1.35, seg_colors(min(i,3),:));
        end

        % End-effector marker
        scatter3(ax, pts(5,1), pts(5,2), pts(5,3), 80, ...
                 [1 0.9 0.2], 'filled', 'MarkerEdgeColor','w');

        draw_reach_circle(ax, d1, a1 + a2 + a3);

        view(ax, 45, 25);
        drawnow limitrate;
    end

end


function T = dh_matrix(theta, d, a, alpha)
    ct = cos(theta); st = sin(theta);
    ca = cos(alpha); sa = sin(alpha);
    T = [ct,  -st*ca,   st*sa,   a*ct;
         st,   ct*ca,  -ct*sa,   a*st;
          0,      sa,      ca,      d;
          0,       0,       0,      1];
end


function draw_tube(ax, p1, p2, r, col)
    n   = 14;
    len = norm(p2 - p1);
    if len < 1e-9; return; end

    th = linspace(0, 2*pi, n+1);
    xc = r * cos(th);
    yc = r * sin(th);
    zc = [0; len];

    [XC, ZC] = meshgrid(xc, zc);
    [YC, ~]  = meshgrid(yc, zc);

    zhat = (p2 - p1) / len;
    if abs(zhat(3)) < 0.999
        xhat = cross([0 0 1], zhat); xhat = xhat/norm(xhat);
    else
        xhat = cross([1 0 0], zhat); xhat = xhat/norm(xhat);
    end
    yhat = cross(zhat, xhat);
    R    = [xhat(:), yhat(:), zhat(:)];

    pts_flat = R * [XC(:)'; YC(:)'; ZC(:)'];
    XW = reshape(pts_flat(1,:), 2, n+1) + p1(1);
    YW = reshape(pts_flat(2,:), 2, n+1) + p1(2);
    ZW = reshape(pts_flat(3,:), 2, n+1) + p1(3);

    surf(ax, XW, YW, ZW, ...
         'FaceColor', col, 'EdgeColor', 'none', ...
         'AmbientStrength', 0.4, 'DiffuseStrength', 0.7, ...
         'SpecularStrength', 0.5, 'FaceLighting', 'gouraud');
end


function draw_sphere(ax, ctr, r, col)
    [xs, ys, zs] = sphere(14);
    surf(ax, xs*r + ctr(1), ys*r + ctr(2), zs*r + ctr(3), ...
         'FaceColor', col, 'EdgeColor', 'none', ...
         'AmbientStrength', 0.4, 'DiffuseStrength', 0.7, ...
         'SpecularStrength', 0.6, 'FaceLighting', 'gouraud');
end


function draw_ground(ax, half)
    fill3(ax, half*[-1 1 1 -1], half*[-1 -1 1 1], [0 0 0 0], ...
          [0.20 0.20 0.23], 'EdgeColor', [0.30 0.30 0.35]);
    for v = linspace(-half, half, 9)
        plot3(ax, [v v],        [-half half], [0 0], 'Color', [0.28 0.28 0.32]);
        plot3(ax, [-half half], [v v],        [0 0], 'Color', [0.28 0.28 0.32]);
    end
    light(ax, 'Position', [1 1 2]*1e4, 'Style', 'infinite');
end


function draw_reach_circle(ax, base_z, radius)
    ang = linspace(0, 2*pi, 120);
    plot3(ax, radius*cos(ang), radius*sin(ang), base_z*ones(1,120), ...
          '--', 'Color', [0.5 0.5 0.5 0.4], 'LineWidth', 0.8);
end
