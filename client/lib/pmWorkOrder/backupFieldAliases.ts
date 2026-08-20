/** Column header aliases for backup / monitoring Excel (normalized via parseSpreadsheet.pickField) */

export const BACKUP_SERIAL_ALIASES = [
  'sn:',
  'sn.',
  'sn',
  'serialnumber',
  'serial number',
  'serial',
  's/n',
];

export const BACKUP_MODEL_ALIASES = [
  'model',
  'model number',
  'device model',
  'manufacturer',
  'product id',
  'pid',
  'equipment name',
  'asset',
];

/** Report "Product" field — Vendor → Manufacturer → Brand → Product */
export const BACKUP_VENDOR_ALIASES = [
  'vendor',
  'vender',
  'vendors',
  'vendor name',
  'manufacturer',
  'brand',
  'product',
];

export const BACKUP_HOSTNAME_ALIASES = ['hostname', 'host name', 'host'];

export const BACKUP_IP_ALIASES = ['ipaddress', 'ip address', 'ip'];

export const BACKUP_SOFTWARE_VERSION_ALIASES = [
  'softwareversion',
  'software version',
  'osversion',
  'os version',
  'firmwareversion',
  'firmware version',
];

export const BACKUP_SYSTEM_UPTIME_ALIASES = ['systemuptime', 'system uptime', 'uptime'];

export const BACKUP_STACK_HA_ROLE_ALIASES = [
  'stacks /ha role',
  'stacks/ha role',
  'stacks ha role',
  'stack no',
  'Stack',
  'stack number',
];

export const BACKUP_STACK_ROLE_ALIASES = ['stacksrole', 'stacks role', 'stackrole', 'stack role','Stack / HA Role'];

export const BACKUP_CPU_USAGE_ALIASES = [
  'cpuusage',
  'cpu usage',
  'cpuprocessor',
  'cpu processor',
  'cpu',
];

export const BACKUP_MEMORY_UTILIZATION_ALIASES = [
  'memoryutilization',
  'memory utilization',
  'memory usage',
  'memory',
];

export const BACKUP_ENVIRONMENT_ALARM_ALIASES = [
  'Environment Status',
  'environment alarm',
  'Environment Alarm',
  'normal operating status',
  'status(condition)',
  'status (condition)',
];

export const BACKUP_POWER_SUPPLY_ALIASES = [
  'powersupply',
  'power supply',
  'power_supply',
  'psu',
  'Power Supply',
];

export const BACKUP_TEMPERATURE_ALIASES = [
  'temperature(celsius)',
  'temperature (celsius)',
  'temperature',
  'temp',
];

export const BACKUP_FILE_SIZE_ALIASES = [
  'filesizekilobyte',
  'file size kilobyte',
  'file size (kilobyte)',
  'filesize',
  'file size',
  'file size kb',
  'filesizekb',
];

export const BACKUP_FAN_ALIASES = ['fan', 'fans'];

export const BACKUP_CONFIGURATION_ALIASES = [
  'backupconfiguration',
  'backup configuration',
  'backupconfig',
  'backup config',
  'backup(reference)',
  'Backup Status',
  'backup',
];

export const BACKUP_REMARK_ALIASES = ['remark', 'remarks'];
