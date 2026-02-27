-- ============================================
-- PM/MA Management System - Useful Queries
-- ============================================

-- ============================================
-- 1. QUERY TASKS WITH ALL RELATIONS
-- ============================================
SELECT 
    t.task_id,
    t.task_type,
    t.title,
    t.start_date,
    t.end_date,
    t.priority,
    t.status,
    s.site_name,
    v.vendor_name,
    c.contract_id,
    c.sla_term,
    GROUP_CONCAT(DISTINCT e.display_name SEPARATOR ', ') AS engineers,
    GROUP_CONCAT(DISTINCT a.device_name SEPARATOR ', ') AS assets
FROM tasks t
LEFT JOIN sites s ON t.site_id = s.site_id
LEFT JOIN contracts c ON t.contract_id = c.contract_id
LEFT JOIN vendors v ON c.vendor_id = v.vendor_id
LEFT JOIN task_assignments ta ON t.task_id = ta.task_id
LEFT JOIN employees e ON ta.employee_id = e.employee_id
LEFT JOIN task_assets tas ON t.task_id = tas.task_id
LEFT JOIN assets a ON tas.device_id = a.device_id
GROUP BY t.task_id, t.task_type, t.title, t.start_date, t.end_date, t.priority, t.status, s.site_name, v.vendor_name, c.contract_id, c.sla_term;

-- ============================================
-- 2. QUERY ASSETS NEEDING PM SOON
-- ============================================
SELECT 
    a.device_id,
    a.device_name,
    dt.device_type_name,
    s.site_name,
    a.next_pm_date,
    DATEDIFF(a.next_pm_date, CURDATE()) AS days_until_pm
FROM assets a
JOIN device_types dt ON a.device_type_id = dt.device_type_id
JOIN sites s ON a.site_id = s.site_id
WHERE a.next_pm_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 1 MONTH)
AND a.status = 'Active'
ORDER BY a.next_pm_date ASC;

-- ============================================
-- 3. QUERY CONTRACTS EXPIRING SOON
-- ============================================
SELECT 
    c.contract_id,
    c.contract_name,
    v.vendor_name,
    s.site_name,
    c.end_date,
    DATEDIFF(c.end_date, CURDATE()) AS days_until_expiry,
    c.sla_percentage
FROM contracts c
JOIN vendors v ON c.vendor_id = v.vendor_id
JOIN sites s ON c.site_id = s.site_id
WHERE c.end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 3 MONTH)
AND c.status = 'Active'
ORDER BY c.end_date ASC;

-- ============================================
-- 4. QUERY EMPLOYEE WORKLOAD
-- ============================================
SELECT 
    e.employee_id,
    e.display_name,
    e.department,
    COUNT(DISTINCT ta.task_id) AS total_tasks,
    COUNT(DISTINCT CASE WHEN t.status = 'In Progress' THEN ta.task_id END) AS in_progress_tasks,
    COUNT(DISTINCT CASE WHEN t.status = 'Scheduled' THEN ta.task_id END) AS scheduled_tasks
FROM employees e
LEFT JOIN task_assignments ta ON e.employee_id = ta.employee_id
LEFT JOIN tasks t ON ta.task_id = t.task_id
GROUP BY e.employee_id, e.display_name, e.department
ORDER BY total_tasks DESC;

-- ============================================
-- 5. QUERY PM HISTORY FOR A DEVICE
-- ============================================
SELECT 
    ph.pm_history_id,
    ph.pm_date,
    ph.status,
    ph.notes,
    e.display_name AS technician,
    t.task_id,
    t.title AS task_title
FROM pm_history ph
JOIN assets a ON ph.device_id = a.device_id
LEFT JOIN employees e ON ph.technician_id = e.employee_id
LEFT JOIN tasks t ON ph.task_id = t.task_id
WHERE a.device_id = 'AS001'
ORDER BY ph.pm_date DESC;

-- ============================================
-- 6. QUERY SLA COMPLIANCE BY VENDOR
-- ============================================
SELECT 
    v.vendor_name,
    COUNT(DISTINCT sc.contract_id) AS total_contracts,
    AVG(sc.sla_percentage) AS avg_sla_percentage,
    COUNT(DISTINCT CASE WHEN sc.status = 'Pass' THEN sc.contract_id END) AS passed,
    COUNT(DISTINCT CASE WHEN sc.status = 'Partial' THEN sc.contract_id END) AS partial,
    COUNT(DISTINCT CASE WHEN sc.status = 'Miss' THEN sc.contract_id END) AS missed,
    COUNT(DISTINCT CASE WHEN sc.status = 'Active' THEN sc.contract_id END) AS active
FROM sla_compliance sc
JOIN vendors v ON sc.vendor_id = v.vendor_id
GROUP BY v.vendor_name
ORDER BY avg_sla_percentage DESC;

-- ============================================
-- 7. QUERY TASKS BY STATUS
-- ============================================
SELECT 
    task_type,
    status,
    COUNT(*) AS count,
    GROUP_CONCAT(task_id SEPARATOR ', ') AS task_ids
FROM tasks
GROUP BY task_type, status
ORDER BY task_type, status;

-- ============================================
-- 8. QUERY ASSETS BY SITE
-- ============================================
SELECT 
    s.site_name,
    dt.device_type_name,
    COUNT(*) AS asset_count,
    COUNT(CASE WHEN a.status = 'Active' THEN 1 END) AS active_count,
    COUNT(CASE WHEN a.status = 'Inactive' THEN 1 END) AS inactive_count,
    COUNT(CASE WHEN a.status = 'Maintenance' THEN 1 END) AS maintenance_count
FROM assets a
JOIN sites s ON a.site_id = s.site_id
JOIN device_types dt ON a.device_type_id = dt.device_type_id
GROUP BY s.site_name, dt.device_type_name
ORDER BY s.site_name, dt.device_type_name;

-- ============================================
-- 9. QUERY UPCOMING TASKS (Next 30 Days)
-- ============================================
SELECT 
    t.task_id,
    t.task_type,
    t.title,
    t.start_date,
    t.end_date,
    t.priority,
    s.site_name,
    GROUP_CONCAT(DISTINCT e.display_name SEPARATOR ', ') AS assigned_engineers
FROM tasks t
JOIN sites s ON t.site_id = s.site_id
LEFT JOIN task_assignments ta ON t.task_id = ta.task_id
LEFT JOIN employees e ON ta.employee_id = e.employee_id
WHERE t.start_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
AND t.status IN ('Scheduled', 'Not Started')
GROUP BY t.task_id, t.task_type, t.title, t.start_date, t.end_date, t.priority, s.site_name
ORDER BY t.start_date ASC, t.priority DESC;

-- ============================================
-- 10. QUERY CONTRACT ASSET BINDINGS
-- ============================================
SELECT 
    c.contract_id,
    c.contract_name,
    v.vendor_name,
    s.site_name,
    COUNT(cab.device_id) AS bound_asset_count,
    GROUP_CONCAT(a.device_name SEPARATOR ', ') AS bound_assets
FROM contracts c
JOIN vendors v ON c.vendor_id = v.vendor_id
JOIN sites s ON c.site_id = s.site_id
LEFT JOIN contract_asset_bindings cab ON c.contract_id = cab.contract_id
LEFT JOIN assets a ON cab.device_id = a.device_id
GROUP BY c.contract_id, c.contract_name, v.vendor_name, s.site_name
ORDER BY bound_asset_count DESC;
