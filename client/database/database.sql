-- ============================================
-- PM/MA Management System - Complete Database
-- ============================================
-- This file contains: Database creation, Schema, and Seed data
-- Run this file to set up the complete database
-- Usage: mysql -u username -p < database/database.sql

-- ============================================
-- PART 1: CREATE DATABASE
-- ============================================
CREATE DATABASE IF NOT EXISTS pm_ma_management 
    CHARACTER SET utf8mb4 
    COLLATE utf8mb4_unicode_ci;

USE pm_ma_management;

-- ============================================
-- PART 2: CREATE TABLES (SCHEMA)
-- ============================================

-- ============================================
-- 1. SITES TABLE
-- ============================================
CREATE TABLE sites (
    site_id VARCHAR(50) PRIMARY KEY,
    site_name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- 2. EMPLOYEES TABLE
-- ============================================
CREATE TABLE employees (
    employee_id VARCHAR(50) PRIMARY KEY,
    display_name VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    department VARCHAR(100) NOT NULL,
    position VARCHAR(100) NOT NULL,
    position_type ENUM('Technical', 'Management', 'Engineer') NOT NULL,
    employment_type ENUM('Full-time', 'Contract', 'Part-time') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_department (department),
    INDEX idx_position_type (position_type)
);

-- ============================================
-- 3. VENDORS TABLE
-- ============================================
CREATE TABLE vendors (
    vendor_id INT AUTO_INCREMENT PRIMARY KEY,
    vendor_name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- 4. DEVICE TYPES TABLE
-- ============================================
CREATE TABLE device_types (
    device_type_id INT AUTO_INCREMENT PRIMARY KEY,
    device_type_name VARCHAR(100) NOT NULL UNIQUE
);

-- Insert default device types
INSERT INTO device_types (device_type_name) VALUES
    ('Network Switch'),
    ('Router'),
    ('Firewall'),
    ('Server'),
    ('Storage System'),
    ('UPS'),
    ('Access Point');

-- ============================================
-- 5. ASSETS/DEVICES TABLE
-- ============================================
CREATE TABLE assets (
    device_id VARCHAR(50) PRIMARY KEY,
    device_name VARCHAR(255) NOT NULL,
    device_type_id INT NOT NULL,
    site_id VARCHAR(50) NOT NULL,
    location VARCHAR(255),
    vendor_id INT,
    model VARCHAR(255),
    serial_number VARCHAR(255) UNIQUE,
    status ENUM('Active', 'Inactive', 'Maintenance') DEFAULT 'Active',
    last_pm_date DATE,
    next_pm_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (device_type_id) REFERENCES device_types(device_type_id),
    FOREIGN KEY (site_id) REFERENCES sites(site_id),
    FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id),
    INDEX idx_site (site_id),
    INDEX idx_status (status),
    INDEX idx_next_pm (next_pm_date)
);

-- ============================================
-- 6. CONTRACTS TABLE (MA - Maintenance Agreement)
-- ============================================
CREATE TABLE contracts (
    contract_id VARCHAR(50) PRIMARY KEY,
    vendor_id INT NOT NULL,
    site_id VARCHAR(50) NOT NULL,
    contract_name VARCHAR(255),
    sla_term ENUM('Design', 'Standard', 'Premium') NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    duration_months INT NOT NULL,
    status ENUM('Active', 'Expired', 'Terminated') DEFAULT 'Active',
    sla_percentage DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id),
    FOREIGN KEY (site_id) REFERENCES sites(site_id),
    INDEX idx_vendor (vendor_id),
    INDEX idx_site (site_id),
    INDEX idx_status (status),
    INDEX idx_dates (start_date, end_date)
);

-- ============================================
-- 7. CONTRACT ASSET BINDINGS (Many-to-Many)
-- ============================================
CREATE TABLE contract_asset_bindings (
    binding_id INT AUTO_INCREMENT PRIMARY KEY,
    contract_id VARCHAR(50) NOT NULL,
    device_id VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contract_id) REFERENCES contracts(contract_id) ON DELETE CASCADE,
    FOREIGN KEY (device_id) REFERENCES assets(device_id) ON DELETE CASCADE,
    UNIQUE KEY unique_contract_device (contract_id, device_id),
    INDEX idx_contract (contract_id),
    INDEX idx_device (device_id)
);

-- ============================================
-- 8. TASKS TABLE (PM and MA Tasks)
-- ============================================
CREATE TABLE tasks (
    task_id VARCHAR(50) PRIMARY KEY,
    task_type ENUM('PM', 'MA') NOT NULL,
    title VARCHAR(255) NOT NULL,
    site_id VARCHAR(50) NOT NULL,
    contract_id VARCHAR(50) NULL, -- NULL for PM tasks, required for MA tasks
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    priority ENUM('Low', 'Medium', 'High') DEFAULT 'Medium',
    coverage_scope TEXT,
    travel_method ENUM('airplane', 'bus', 'private-car', 'train', 'other') NULL,
    travel_cost DECIMAL(10,2) NULL,
    status ENUM('Scheduled', 'In Progress', 'Done', 'Failed', 'Not Started') DEFAULT 'Scheduled',
    actually_went BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (site_id) REFERENCES sites(site_id),
    FOREIGN KEY (contract_id) REFERENCES contracts(contract_id) ON DELETE SET NULL,
    INDEX idx_task_type (task_type),
    INDEX idx_site (site_id),
    INDEX idx_status (status),
    INDEX idx_dates (start_date, end_date)
);

-- ============================================
-- 9. TASK ASSIGNMENTS (Many-to-Many: Tasks to Engineers)
-- ============================================
CREATE TABLE task_assignments (
    assignment_id INT AUTO_INCREMENT PRIMARY KEY,
    task_id VARCHAR(50) NOT NULL,
    employee_id VARCHAR(50) NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE,
    UNIQUE KEY unique_task_employee (task_id, employee_id),
    INDEX idx_task (task_id),
    INDEX idx_employee (employee_id)
);

-- ============================================
-- 10. TASK ASSETS (Many-to-Many: Tasks to Assets)
-- ============================================
CREATE TABLE task_assets (
    task_asset_id INT AUTO_INCREMENT PRIMARY KEY,
    task_id VARCHAR(50) NOT NULL,
    device_id VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE,
    FOREIGN KEY (device_id) REFERENCES assets(device_id) ON DELETE CASCADE,
    UNIQUE KEY unique_task_device (task_id, device_id),
    INDEX idx_task (task_id),
    INDEX idx_device (device_id)
);

-- ============================================
-- 11. PM HISTORY TABLE
-- ============================================
CREATE TABLE pm_history (
    pm_history_id VARCHAR(50) PRIMARY KEY,
    device_id VARCHAR(50) NOT NULL,
    task_id VARCHAR(50) NULL, -- Link to task if available
    pm_date DATE NOT NULL,
    technician_id VARCHAR(50) NOT NULL,
    status ENUM('Done', 'In Progress', 'Failed', 'Scheduled') NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES assets(device_id) ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE SET NULL,
    FOREIGN KEY (technician_id) REFERENCES employees(employee_id),
    INDEX idx_device (device_id),
    INDEX idx_date (pm_date),
    INDEX idx_status (status)
);

-- ============================================
-- 12. TASK PHOTOS TABLE
-- ============================================
CREATE TABLE task_photos (
    photo_id INT AUTO_INCREMENT PRIMARY KEY,
    task_id VARCHAR(50) NOT NULL,
    photo_url VARCHAR(500) NOT NULL, -- Can store base64 or file path/URL
    photo_type ENUM('base64', 'url', 'file_path') DEFAULT 'url',
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE,
    INDEX idx_task (task_id)
);

-- ============================================
-- 13. SLA COMPLIANCE TABLE
-- ============================================
CREATE TABLE sla_compliance (
    compliance_id INT AUTO_INCREMENT PRIMARY KEY,
    contract_id VARCHAR(50) NOT NULL,
    vendor_id INT NOT NULL,
    site_id VARCHAR(50) NOT NULL,
    sla_percentage DECIMAL(5,2) NOT NULL,
    status ENUM('Pass', 'Partial', 'Miss', 'Active') NOT NULL,
    measured_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contract_id) REFERENCES contracts(contract_id) ON DELETE CASCADE,
    FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id),
    FOREIGN KEY (site_id) REFERENCES sites(site_id),
    INDEX idx_contract (contract_id),
    INDEX idx_status (status),
    INDEX idx_date (measured_date)
);

-- ============================================
-- 14. DEPARTMENTS TABLE (Reference Data)
-- ============================================
CREATE TABLE departments (
    department_id INT AUTO_INCREMENT PRIMARY KEY,
    department_name VARCHAR(100) NOT NULL UNIQUE
);

-- Insert default departments
INSERT INTO departments (department_name) VALUES
    ('IT'),
    ('HR'),
    ('Sales'),
    ('Finance'),
    ('Marketing'),
    ('Operations');

-- ============================================
-- 15. POSITIONS TABLE (Reference Data)
-- ============================================
CREATE TABLE positions (
    position_id INT AUTO_INCREMENT PRIMARY KEY,
    position_name VARCHAR(100) NOT NULL,
    position_type ENUM('Technical', 'Management', 'Engineer') NOT NULL,
    UNIQUE KEY unique_position_type (position_name, position_type)
);

-- Insert default positions
INSERT INTO positions (position_name, position_type) VALUES
    -- Technical positions
    ('Junior Developer', 'Technical'),
    ('Senior Developer', 'Technical'),
    ('DevOps Engineer', 'Technical'),
    ('System Analyst', 'Technical'),
    ('Accountant', 'Technical'),
    ('Sales Executive', 'Technical'),
    ('Sales Representative', 'Technical'),
    ('Content Creator', 'Technical'),
    ('HR Officer', 'Technical'),
    ('Recruiter', 'Technical'),
    ('Designer', 'Technical'),
    ('Data Analyst', 'Technical'),
    -- Management positions
    ('IT Manager', 'Management'),
    ('HR Manager', 'Management'),
    ('Sales Manager', 'Management'),
    ('Finance Manager', 'Management'),
    ('Marketing Manager', 'Management'),
    ('Operations Manager', 'Management'),
    ('Team Lead', 'Management'),
    ('Director', 'Management');

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
-- Additional composite indexes for common queries
CREATE INDEX idx_tasks_type_status ON tasks(task_type, status);
CREATE INDEX idx_assets_site_status ON assets(site_id, status);
CREATE INDEX idx_contracts_vendor_status ON contracts(vendor_id, status);

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- View: Task Details with Related Information
CREATE VIEW vw_task_details AS
SELECT 
    t.task_id,
    t.task_type,
    t.title,
    t.start_date,
    t.end_date,
    t.priority,
    t.status,
    s.site_name,
    s.site_id,
    c.contract_id,
    c.vendor_id,
    v.vendor_name,
    GROUP_CONCAT(DISTINCT e.display_name SEPARATOR ', ') AS assigned_engineers,
    GROUP_CONCAT(DISTINCT a.device_name SEPARATOR ', ') AS assigned_assets
FROM tasks t
LEFT JOIN sites s ON t.site_id = s.site_id
LEFT JOIN contracts c ON t.contract_id = c.contract_id
LEFT JOIN vendors v ON c.vendor_id = v.vendor_id
LEFT JOIN task_assignments ta ON t.task_id = ta.task_id
LEFT JOIN employees e ON ta.employee_id = e.employee_id
LEFT JOIN task_assets tas ON t.task_id = tas.task_id
LEFT JOIN assets a ON tas.device_id = a.device_id
GROUP BY t.task_id, t.task_type, t.title, t.start_date, t.end_date, t.priority, t.status, s.site_name, s.site_id, c.contract_id, c.vendor_id, v.vendor_name;

-- View: Asset PM Summary
CREATE VIEW vw_asset_pm_summary AS
SELECT 
    a.device_id,
    a.device_name,
    a.device_type_id,
    dt.device_type_name,
    a.site_id,
    s.site_name,
    a.vendor_id,
    v.vendor_name,
    a.last_pm_date,
    a.next_pm_date,
    a.status,
    COUNT(ph.pm_history_id) AS total_pm_count,
    MAX(ph.pm_date) AS latest_pm_date
FROM assets a
LEFT JOIN device_types dt ON a.device_type_id = dt.device_type_id
LEFT JOIN sites s ON a.site_id = s.site_id
LEFT JOIN vendors v ON a.vendor_id = v.vendor_id
LEFT JOIN pm_history ph ON a.device_id = ph.device_id
GROUP BY a.device_id, a.device_name, a.device_type_id, dt.device_type_name, a.site_id, s.site_name, a.vendor_id, v.vendor_name, a.last_pm_date, a.next_pm_date, a.status;

-- View: Contract SLA Summary
CREATE VIEW vw_contract_sla_summary AS
SELECT 
    c.contract_id,
    c.contract_name,
    v.vendor_name,
    s.site_name,
    c.sla_term,
    c.start_date,
    c.end_date,
    c.status AS contract_status,
    sc.sla_percentage,
    sc.status AS sla_status,
    sc.measured_date,
    COUNT(cab.device_id) AS bound_asset_count
FROM contracts c
LEFT JOIN vendors v ON c.vendor_id = v.vendor_id
LEFT JOIN sites s ON c.site_id = s.site_id
LEFT JOIN sla_compliance sc ON c.contract_id = sc.contract_id
LEFT JOIN contract_asset_bindings cab ON c.contract_id = cab.contract_id
GROUP BY c.contract_id, c.contract_name, v.vendor_name, s.site_name, c.sla_term, c.start_date, c.end_date, c.status, sc.sla_percentage, sc.status, sc.measured_date;

-- ============================================
-- PART 3: SEED DATA
-- ============================================

-- ============================================
-- 1. INSERT SITES
-- ============================================
INSERT INTO sites (site_id, site_name) VALUES


-- ============================================
-- 2. INSERT VENDORS
-- ============================================
INSERT INTO vendors (vendor_name) VALUES
    ('Cisco'),
    ('HPE'),
    ('Fortinet'),
    ('PALO'),
    ('Juniper'),
    ('Dell'),
    ('Aruba'),
    ('APC');

-- ============================================
-- 3. INSERT EMPLOYEES
-- ============================================
INSERT INTO employees (employee_id, display_name, first_name, last_name, department, position, position_type, employment_type) VALUES

-- ============================================
-- 4. INSERT ASSETS/DEVICES
-- ============================================
INSERT INTO assets (device_id, device_name, device_type_id, site_id, location, vendor_id, model, serial_number, status, last_pm_date, next_pm_date) VALUES
   
-- ============================================
-- 5. INSERT CONTRACTS (MA)
-- ============================================
INSERT INTO contracts (contract_id, vendor_id, site_id, contract_name, sla_term, start_date, end_date, duration_months, status, sla_percentage) VALUES

-- ============================================
-- 6. INSERT CONTRACT ASSET BINDINGS
-- ============================================
INSERT INTO contract_asset_bindings (contract_id, device_id) VALUES
  

-- ============================================
-- 7. INSERT TASKS (PM and MA)
-- ============================================
INSERT INTO tasks (task_id, task_type, title, site_id, contract_id, start_date, end_date, priority, coverage_scope, travel_method, travel_cost, status) VALUES

-- ============================================
-- 8. INSERT TASK ASSIGNMENTS
-- ============================================
INSERT INTO task_assignments (task_id, employee_id) VALUES


-- ============================================
-- 9. INSERT TASK ASSETS
-- ============================================
INSERT INTO task_assets (task_id, device_id) VALUES
  

-- ============================================
-- 10. INSERT PM HISTORY
-- ============================================
INSERT INTO pm_history (pm_history_id, device_id, task_id, pm_date, technician_id, status, notes) VALUES
   
