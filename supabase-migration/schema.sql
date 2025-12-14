-- ================================================================
-- RGB Studio Calendar - Database Schema
-- Supabase PostgreSQL Schema
-- Version: 1.0
-- Date: December 2024
-- ================================================================

-- Drop tables if they exist (in reverse dependency order)
DROP TABLE IF EXISTS booking_materials CASCADE;
DROP TABLE IF EXISTS booking_technical_services CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS client_contacts CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS materials CASCADE;
DROP TABLE IF EXISTS technical_services CASCADE;
DROP TABLE IF EXISTS personnel CASCADE;
DROP TABLE IF EXISTS resources CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ================================================================
-- TABLE 1: resources (editing rooms)
-- ================================================================
CREATE TABLE resources (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('Offline', 'Online', 'Cinema', 'Technical')),
    color VARCHAR(100) NOT NULL,
    list_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_resources_type ON resources(type);

COMMENT ON TABLE resources IS 'Studio editing rooms and resources';
COMMENT ON COLUMN resources.type IS 'Room type: Offline, Online, Cinema, or Technical';
COMMENT ON COLUMN resources.color IS 'Tailwind CSS color classes for UI display';
COMMENT ON COLUMN resources.list_price IS 'Daily list price in ILS';

-- ================================================================
-- TABLE 2: personnel (staff members)
-- ================================================================
CREATE TABLE personnel (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL,
    rate DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE personnel IS 'Staff members and freelancers';
COMMENT ON COLUMN personnel.role IS 'Job role: Video Editor, Colorist, Sound Engineer, etc.';
COMMENT ON COLUMN personnel.rate IS 'Daily rate in ILS';

-- ================================================================
-- TABLE 3: technical_services (technical services)
-- ================================================================
CREATE TABLE technical_services (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE technical_services IS 'Technical services offered by the studio';
COMMENT ON COLUMN technical_services.price IS 'Service price in ILS';

-- ================================================================
-- TABLE 4: materials (raw materials/hardware)
-- ================================================================
CREATE TABLE materials (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    purchase_price DECIMAL(10,2) NOT NULL,
    selling_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE materials IS 'Hardware and raw materials inventory';
COMMENT ON COLUMN materials.purchase_price IS 'Purchase cost in ILS';
COMMENT ON COLUMN materials.selling_price IS 'Recommended selling price in ILS';

-- ================================================================
-- TABLE 5: clients (customers)
-- ================================================================
CREATE TABLE clients (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    business_id VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_clients_name ON clients(name);
CREATE UNIQUE INDEX idx_clients_business_id ON clients(business_id);

COMMENT ON TABLE clients IS 'Client companies and organizations';
COMMENT ON COLUMN clients.business_id IS 'Tax ID / Company registration number';

-- ================================================================
-- TABLE 6: client_contacts (client contact persons)
-- ================================================================
CREATE TABLE client_contacts (
    id VARCHAR(50) PRIMARY KEY,
    client_id VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_client_contacts_client 
        FOREIGN KEY (client_id) 
        REFERENCES clients(id) 
        ON DELETE CASCADE
);

CREATE INDEX idx_client_contacts_client_id ON client_contacts(client_id);

COMMENT ON TABLE client_contacts IS 'Contact persons for each client';
COMMENT ON CONSTRAINT fk_client_contacts_client ON client_contacts IS 'Deleting a client cascades to their contacts';

-- ================================================================
-- TABLE 7: projects
-- ================================================================
CREATE TABLE projects (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    client_id VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'In Progress' CHECK (status IN ('In Progress', 'Completed', 'On Hold')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_projects_client 
        FOREIGN KEY (client_id) 
        REFERENCES clients(id) 
        ON DELETE RESTRICT
);

CREATE INDEX idx_projects_client_id ON projects(client_id);
CREATE INDEX idx_projects_status ON projects(status);

COMMENT ON TABLE projects IS 'Client projects';
COMMENT ON COLUMN projects.status IS 'Project status: In Progress, Completed, or On Hold';
COMMENT ON CONSTRAINT fk_projects_client ON projects IS 'Cannot delete client with active projects';

-- ================================================================
-- TABLE 8: bookings (room bookings)
-- ================================================================
CREATE TABLE bookings (
    id VARCHAR(50) PRIMARY KEY,
    project_id VARCHAR(50) NOT NULL,
    client_id VARCHAR(50) NOT NULL,
    resource_id VARCHAR(50) NOT NULL,
    personnel_id VARCHAR(50),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL CHECK (end_date >= start_date),
    start_time TIME,
    end_time TIME,
    notes TEXT,
    do_not_charge_resource BOOLEAN DEFAULT FALSE,
    billed BOOLEAN DEFAULT FALSE,
    billed_date DATE,
    billing_amount DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    
    CONSTRAINT fk_bookings_project 
        FOREIGN KEY (project_id) 
        REFERENCES projects(id) 
        ON DELETE RESTRICT,
    
    CONSTRAINT fk_bookings_client 
        FOREIGN KEY (client_id) 
        REFERENCES clients(id) 
        ON DELETE RESTRICT,
    
    CONSTRAINT fk_bookings_resource 
        FOREIGN KEY (resource_id) 
        REFERENCES resources(id) 
        ON DELETE RESTRICT,
    
    CONSTRAINT fk_bookings_personnel 
        FOREIGN KEY (personnel_id) 
        REFERENCES personnel(id) 
        ON DELETE SET NULL
);

CREATE INDEX idx_bookings_project_id ON bookings(project_id);
CREATE INDEX idx_bookings_resource_id ON bookings(resource_id);
CREATE INDEX idx_bookings_dates ON bookings(start_date, end_date);
CREATE INDEX idx_bookings_deleted_at ON bookings(deleted_at);
CREATE INDEX idx_bookings_billed ON bookings(billed);

COMMENT ON TABLE bookings IS 'Room and resource bookings';
COMMENT ON COLUMN bookings.do_not_charge_resource IS 'If true, do not charge for the room';
COMMENT ON COLUMN bookings.billed IS 'Whether the booking has been billed to the client';
COMMENT ON COLUMN bookings.billing_amount IS 'Actual amount billed in ILS';
COMMENT ON COLUMN bookings.deleted_at IS 'Soft delete timestamp - booking marked as deleted but not removed';
COMMENT ON CONSTRAINT fk_bookings_personnel ON bookings IS 'If personnel is deleted, set to NULL';

-- ================================================================
-- TABLE 9: booking_technical_services (junction table)
-- ================================================================
CREATE TABLE booking_technical_services (
    id VARCHAR(50) PRIMARY KEY,
    booking_id VARCHAR(50) NOT NULL,
    technical_service_id VARCHAR(50) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_booking_tech_services_booking 
        FOREIGN KEY (booking_id) 
        REFERENCES bookings(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_booking_tech_services_service 
        FOREIGN KEY (technical_service_id) 
        REFERENCES technical_services(id) 
        ON DELETE CASCADE
);

CREATE INDEX idx_booking_tech_services_booking_id ON booking_technical_services(booking_id);
CREATE INDEX idx_booking_tech_services_service_id ON booking_technical_services(technical_service_id);

COMMENT ON TABLE booking_technical_services IS 'Technical services attached to bookings (many-to-many)';
COMMENT ON COLUMN booking_technical_services.quantity IS 'Number of times the service is used';

-- ================================================================
-- TABLE 10: booking_materials (junction table)
-- ================================================================
CREATE TABLE booking_materials (
    id VARCHAR(50) PRIMARY KEY,
    booking_id VARCHAR(50) NOT NULL,
    material_id VARCHAR(50) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_booking_materials_booking 
        FOREIGN KEY (booking_id) 
        REFERENCES bookings(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_booking_materials_material 
        FOREIGN KEY (material_id) 
        REFERENCES materials(id) 
        ON DELETE CASCADE
);

CREATE INDEX idx_booking_materials_booking_id ON booking_materials(booking_id);
CREATE INDEX idx_booking_materials_material_id ON booking_materials(material_id);

COMMENT ON TABLE booking_materials IS 'Materials attached to bookings (many-to-many)';
COMMENT ON COLUMN booking_materials.quantity IS 'Quantity of material used (can be 0 or positive)';

-- ================================================================
-- TABLE 11: users (system users)
-- ================================================================
CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'technician')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_users_username ON users(username);
CREATE UNIQUE INDEX idx_users_email ON users(email);

COMMENT ON TABLE users IS 'System users for authentication';
COMMENT ON COLUMN users.password IS 'Plain text password - SHOULD BE ENCRYPTED in production';
COMMENT ON COLUMN users.role IS 'User role: admin or technician';

-- ================================================================
-- END OF SCHEMA
-- ================================================================
