# 📋 GET Endpoints - Device Controller

## Base URL
`/api/devices`

---

## 1. GET `/api/devices` - ดึงข้อมูล Devices ทั้งหมด (พร้อม Pagination และ Search)

### Description
ดึงข้อมูล Devices ทั้งหมดพร้อม pagination และ search functionality

### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | 1 | หน้าปัจจุบัน |
| `limit` | number | No | 50 | จำนวน records ต่อหน้า |
| `search` | string | No | - | คำค้นหา (ค้นหาใน Asset_State, serial, CI_Name, Asset_Number, PR_No, Vendor, Project_purchase) |

### Example Requests

#### 1.1 ดึงข้อมูลหน้าแรก (default)
```bash
GET /api/devices
```

#### 1.2 ดึงข้อมูลหน้าที่ 2 (50 records ต่อหน้า)
```bash
GET /api/devices?page=2&limit=50
```

#### 1.3 ค้นหา Devices
```bash
GET /api/devices?search=Dell
```

#### 1.4 ค้นหา + Pagination
```bash
GET /api/devices?search=Server&page=1&limit=20
```

### Example Response
```json
{
  "success": true,
  "pagination": {
    "currentPage": 1,
    "totalPages": 10,
    "totalRecords": 500,
    "recordsPerPage": 50,
    "hasNextPage": true,
    "hasPreviousPage": false
  },
  "search": "Dell",
  "assetStateStats": [
    {
      "Asset_State": "In Store",
      "total": 25
    },
    {
      "Asset_State": "Out Store",
      "total": 15
    }
  ],
  "count": 50,
  "data": [
    {
      "Did": 1,
      "Asset_State": "In Store",
      "serial": "ABC123",
      "CI_Name": "Server-01",
      "Asset_Number": "AST-001",
      "PR_No": "PR-001",
      "Vendor": "Dell",
      "Project_purchase": "Data Center",
      "Sid": 1,
      "Location2": "Room A",
      "PO_No": "PO-001",
      "Loan_Start": "2024-01-01",
      "Request_Date": null,
      "Refer_SOF": "SOF-001",
      "Refer_Ticket": "TKT-001",
      "Assigned_Service": "IT",
      "Reason": "New Installation",
      "Dtypeid": 1,
      "model": "Dell PowerEdge R740",
      "Manufacturername": "Dell",
      "Sitename": "Bangkok Office"
    }
  ]
}
```

---

## 2. GET `/api/devices/exclude-in-store` - ดึงข้อมูล Devices ที่ไม่ใช่ "In Store"

### Description
ดึงข้อมูล Devices ทั้งหมดยกเว้นที่มี Asset_State = "In Store" (พร้อม Pagination และ Search)

### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | 1 | หน้าปัจจุบัน |
| `limit` | number | No | 50 | จำนวน records ต่อหน้า |
| `search` | string | No | - | คำค้นหา |

### Example Requests

#### 2.1 ดึงข้อมูลหน้าแรก
```bash
GET /api/devices/exclude-in-store
```

#### 2.2 ค้นหา + Pagination
```bash
GET /api/devices/exclude-in-store?search=Server&page=1&limit=20
```

### Example Response
```json
{
  "success": true,
  "excludedAssetState": "In Store",
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalRecords": 250,
    "recordsPerPage": 50,
    "hasNextPage": true,
    "hasPreviousPage": false
  },
  "search": null,
  "assetStateStats": null,
  "count": 50,
  "data": [...]
}
```

---

## 3. GET `/api/devices/exclude-out-store` - ดึงข้อมูล Devices ที่ไม่ใช่ "Out Store"

### Description
ดึงข้อมูล Devices ทั้งหมดยกเว้นที่มี Asset_State = "Out Store" (พร้อม Pagination และ Search)

### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | 1 | หน้าปัจจุบัน |
| `limit` | number | No | 50 | จำนวน records ต่อหน้า |
| `search` | string | No | - | คำค้นหา |

### Example Requests

#### 3.1 ดึงข้อมูลหน้าแรก
```bash
GET /api/devices/exclude-out-store
```

#### 3.2 ค้นหา + Pagination
```bash
GET /api/devices/exclude-out-store?search=HP&page=1&limit=20
```

### Example Response
```json
{
  "success": true,
  "excludedAssetState": "Out Store",
  "pagination": {
    "currentPage": 1,
    "totalPages": 8,
    "totalRecords": 400,
    "recordsPerPage": 50,
    "hasNextPage": true,
    "hasPreviousPage": false
  },
  "search": null,
  "assetStateStats": null,
  "count": 50,
  "data": [...]
}
```

---

## 4. GET `/api/devices/:id` - ดึงข้อมูล Device ตาม ID

### Description
ดึงข้อมูล Device ตาม ID พร้อมข้อมูล Device_Type, Manufacturer, และ Site

### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | number | Yes | Device ID (Did) |

### Example Requests

#### 4.1 ดึงข้อมูล Device ID 1
```bash
GET /api/devices/1
```

#### 4.2 ดึงข้อมูล Device ID 100
```bash
GET /api/devices/100
```

### Example Response
```json
{
  "success": true,
  "data": {
    "Did": 1,
    "Asset_State": "In Store",
    "serial": "ABC123",
    "CI_Name": "Server-01",
    "Asset_Number": "AST-001",
    "PR_No": "PR-001",
    "Vendor": "Dell",
    "Project_purchase": "Data Center",
    "Sid": 1,
    "Location2": "Room A",
    "PO_No": "PO-001",
    "Loan_Start": "2024-01-01",
    "Request_Date": null,
    "Refer_SOF": "SOF-001",
    "Refer_Ticket": "TKT-001",
    "Assigned_Service": "IT",
    "Reason": "New Installation",
    "Dtypeid": 1,
    "model": "Dell PowerEdge R740",
    "Manufacturername": "Dell",
    "Sitename": "Bangkok Office"
  }
}
```

### Error Response (404)
```json
{
  "success": false,
  "message": "ไม่พบข้อมูล Device"
}
```

---

## 5. GET `/api/devices/dashboard` - Dashboard Statistics

### Description
ดึงข้อมูลสถิติสำหรับ Dashboard รวมถึง:
- จำนวน Devices ต่อ Site
- จำนวน Devices ทั้งหมด
- จำนวน Devices ต่อ Asset_State
- จำนวน Devices ที่ available (Request_Date IS NULL)
- จำนวน Devices ที่ requested (Request_Date IS NOT NULL)
- จำนวน Devices ต่อ Model
- จำนวน Devices ต่อ Manufacturer

### Example Request
```bash
GET /api/devices/dashboard
```

### Example Response
```json
{
  "success": true,
  "data": {
    "totalDevices": 1000,
    "availableDevices": 750,
    "requestedDevices": 250,
    "siteStats": [
      {
        "site_name": "Bangkok Office",
        "total": 500
      },
      {
        "site_name": "Chiang Mai Office",
        "total": 300
      },
      {
        "site_name": "Phuket Office",
        "total": 200
      }
    ],
    "assetStateStats": [
      {
        "Asset_State": "In Store",
        "total": 600
      },
      {
        "Asset_State": "Out Store",
        "total": 400
      }
    ],
    "modelStats": [
      {
        "model": "Dell PowerEdge R740",
        "total": 300
      },
      {
        "model": "HP ProLiant DL380",
        "total": 250
      },
      {
        "model": "Cisco Catalyst 9300",
        "total": 200
      }
    ],
    "manufacturerStats": [
      {
        "manufacturer": "Dell",
        "total": 400
      },
      {
        "manufacturer": "HP",
        "total": 350
      },
      {
        "manufacturer": "Cisco",
        "total": 250
      }
    ]
  }
}
```

---

## 6. GET `/api/devices/by-model` - ดึงข้อมูล Devices แยกตาม Model

### Description
ดึงข้อมูล Devices แยกตาม Model พร้อม Asset_State breakdown และ Manufacturer

### Example Request
```bash
GET /api/devices/by-model
```

### Example Response
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "model": "Dell PowerEdge R740",
      "Manufacturername": "Dell",
      "total": 300,
      "assetStates": [
        {
          "Asset_State": "In Store",
          "count": 200
        },
        {
          "Asset_State": "Out Store",
          "count": 100
        }
      ]
    },
    {
      "model": "HP ProLiant DL380",
      "Manufacturername": "HP",
      "total": 250,
      "assetStates": [
        {
          "Asset_State": "In Store",
          "count": 150
        },
        {
          "Asset_State": "Out Store",
          "count": 100
        }
      ]
    },
    {
      "model": "Cisco Catalyst 9300",
      "Manufacturername": "Cisco",
      "total": 200,
      "assetStates": [
        {
          "Asset_State": "In Store",
          "count": 120
        },
        {
          "Asset_State": "Out Store",
          "count": 80
        }
      ]
    }
  ]
}
```

---

## 7. GET `/api/devices/history` - ดูประวัติการเปลี่ยนแปลงของ Devices ทั้งหมด

### Description
ดึงประวัติการเปลี่ยนแปลงของ Devices ทั้งหมดพร้อมข้อมูล Device, Device_Type, Manufacturer, และ Site

### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | 1 | หน้าปัจจุบัน |
| `limit` | number | No | 50 | จำนวน records ต่อหน้า |
| `action` | string | No | - | Filter by action (INSERT, UPDATE, ASSET_STATE_CHANGE) |
| `deviceId` | number | No | - | Filter by Device ID |
| `search` | string | No | - | คำค้นหา (ค้นหาใน CI_Name, Asset_Number, serial, model, manufacturer name, site name) |

### Example Requests

#### 7.1 ดึงประวัติทั้งหมด
```bash
GET /api/devices/history
```

#### 7.2 Filter by Action
```bash
GET /api/devices/history?action=INSERT
GET /api/devices/history?action=UPDATE
GET /api/devices/history?action=ASSET_STATE_CHANGE
```

#### 7.3 Filter by Device ID
```bash
GET /api/devices/history?deviceId=1
```

#### 7.4 Search
```bash
GET /api/devices/history?search=Server-01
```

#### 7.5 Combined Filters
```bash
GET /api/devices/history?action=UPDATE&deviceId=1&page=1&limit=20
```

### Example Response
```json
{
  "success": true,
  "pagination": {
    "currentPage": 1,
    "totalPages": 10,
    "totalRecords": 500,
    "recordsPerPage": 50,
    "hasNextPage": true,
    "hasPreviousPage": false
  },
  "filters": {
    "action": "UPDATE",
    "deviceId": null,
    "search": null
  },
  "count": 50,
  "data": [
    {
      "Historyid": 1,
      "Did": 1,
      "Action": "UPDATE",
      "Old_Value": null,
      "New_Value": null,
      "Changed_Fields": {
        "Asset_State": "In Store",
        "Location2": "Room B"
      },
      "Created_At": "2024-01-15T10:30:00.000Z",
      "User": "admin",
      "Device": {
        "Asset_State": "In Store",
        "serial": "ABC123",
        "CI_Name": "Server-01",
        "Asset_Number": "AST-001",
        "PR_No": "PR-001",
        "Vendor": "Dell",
        "Project_purchase": "Data Center",
        "Location2": "Room B",
        "model": "Dell PowerEdge R740",
        "Manufacturername": "Dell",
        "Sitename": "Bangkok Office"
      }
    }
  ]
}
```

---

## 8. GET `/api/devices/:id/history` - ดึงประวัติการเปลี่ยนแปลงของ Device

### Description
ดึงประวัติการเปลี่ยนแปลงของ Device ตาม ID

### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | number | Yes | Device ID (Did) |

### Query Parameters
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `action` | string | No | - | Filter by action (INSERT, UPDATE, ASSET_STATE_CHANGE) |

### Example Requests

#### 8.1 ดึงประวัติทั้งหมดของ Device ID 1
```bash
GET /api/devices/1/history
```

#### 8.2 Filter by Action
```bash
GET /api/devices/1/history?action=ASSET_STATE_CHANGE
```

### Example Response
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "Historyid": 1,
      "Did": 1,
      "Action": "INSERT",
      "Old_Value": null,
      "New_Value": "In Store",
      "Changed_Fields": null,
      "Created_At": "2024-01-01T08:00:00.000Z",
      "User": "admin"
    },
    {
      "Historyid": 2,
      "Did": 1,
      "Action": "ASSET_STATE_CHANGE",
      "Old_Value": "In Store",
      "New_Value": "Out Store",
      "Changed_Fields": null,
      "Created_At": "2024-01-10T14:30:00.000Z",
      "User": "user1"
    },
    {
      "Historyid": 3,
      "Did": 1,
      "Action": "UPDATE",
      "Old_Value": null,
      "New_Value": null,
      "Changed_Fields": {
        "Location2": "Room B",
        "Assigned_Service": "IT Operations"
      },
      "Created_At": "2024-01-15T10:00:00.000Z",
      "User": "admin"
    }
  ]
}
```

### Error Response (404)
```json
{
  "success": false,
  "message": "ไม่พบข้อมูล Device"
}
```

---

## 📝 สรุป GET Endpoints

| # | Endpoint | Description | Pagination | Search | Filters |
|---|----------|-------------|------------|--------|---------|
| 1 | `GET /api/devices` | ดึง Devices ทั้งหมด | ✅ | ✅ | - |
| 2 | `GET /api/devices/exclude-in-store` | ดึง Devices (ไม่รวม In Store) | ✅ | ✅ | - |
| 3 | `GET /api/devices/exclude-out-store` | ดึง Devices (ไม่รวม Out Store) | ✅ | ✅ | - |
| 4 | `GET /api/devices/:id` | ดึง Device ตาม ID | ❌ | ❌ | - |
| 5 | `GET /api/devices/dashboard` | Dashboard Statistics | ❌ | ❌ | - |
| 6 | `GET /api/devices/by-model` | Devices แยกตาม Model | ❌ | ❌ | - |
| 7 | `GET /api/devices/history` | ประวัติ Devices ทั้งหมด | ✅ | ✅ | action, deviceId |
| 8 | `GET /api/devices/:id/history` | ประวัติ Device ตาม ID | ❌ | ❌ | action |

---

## 🔧 ตัวอย่างการใช้งาน (cURL)

### 1. ดึง Devices ทั้งหมด
```bash
curl -X GET "http://localhost:5000/api/devices?page=1&limit=50"
```

### 2. ค้นหา Devices
```bash
curl -X GET "http://localhost:5000/api/devices?search=Dell&page=1&limit=20"
```

### 3. ดึง Device ตาม ID
```bash
curl -X GET "http://localhost:5000/api/devices/1"
```

### 4. Dashboard Statistics
```bash
curl -X GET "http://localhost:5000/api/devices/dashboard"
```

### 5. Devices แยกตาม Model
```bash
curl -X GET "http://localhost:5000/api/devices/by-model"
```

### 6. ประวัติ Devices
```bash
curl -X GET "http://localhost:5000/api/devices/history?action=UPDATE&page=1&limit=20"
```

### 7. ประวัติ Device ตาม ID
```bash
curl -X GET "http://localhost:5000/api/devices/1/history"
```

---

## 🔧 ตัวอย่างการใช้งาน (JavaScript/Fetch)

### 1. ดึง Devices ทั้งหมด
```javascript
const response = await fetch('http://localhost:5000/api/devices?page=1&limit=50');
const data = await response.json();
console.log(data);
```

### 2. ค้นหา Devices
```javascript
const response = await fetch('http://localhost:5000/api/devices?search=Dell&page=1&limit=20');
const data = await response.json();
console.log(data);
```

### 3. Dashboard Statistics
```javascript
const response = await fetch('http://localhost:5000/api/devices/dashboard');
const data = await response.json();
console.log(data.data);
```

### 4. ประวัติ Device
```javascript
const deviceId = 1;
const response = await fetch(`http://localhost:5000/api/devices/${deviceId}/history`);
const data = await response.json();
console.log(data.data);
```

---

## ⚠️ หมายเหตุ

1. **Pagination**: Default page = 1, limit = 50
2. **Search**: Case-insensitive, ค้นหาในหลาย fields
3. **Filters**: 
   - `action` ต้องเป็น: INSERT, UPDATE, หรือ ASSET_STATE_CHANGE
   - `deviceId` ต้องเป็น number
4. **Error Handling**: ทุก endpoint จะ return error message ในรูปแบบ JSON
5. **Response Format**: ทุก endpoint จะ return `success: true/false` และ `data` หรือ `error`


















