# Cifrado, custodia y verificación de respaldos

**Estado: implementado, verificado solo en parte. No apto para producción** hasta completar §6 y los criterios de §10.
Un procedimiento escrito no protege ningún respaldo ni demuestra recuperación. Ningún respaldo productivo debe cifrarse
ni retirarse todavía.

Alcance: dumps `pg_dump` formato custom. No cubre Storage, roles, event triggers ni configuración; la recuperación
integral se rige por [BACKUP_RESTORE_ROLLBACK.md](BACKUP_RESTORE_ROLLBACK.md) y los objetivos por
[data-recovery-objectives.md](data-recovery-objectives.md), todos sin verificar.

Este documento es público: no registrar aquí inventarios reales, hashes de respaldos productivos, estado de equipos,
ubicación de claves ni evidencia. Todo eso vive fuera del repositorio.

## 1. Arquitectura

| Capa | Decisión |
|---|---|
| Cifrado por archivo | `age` v1.3.2, exactamente dos destinatarios X25519 nativos: primario y recuperación |
| Confianza | Política externa fijada por SHA-256 en los scripts instalados; solo un administrador puede escribirlas |
| Autenticidad | `SHA256SUMS.txt` firmado con Ed25519 dedicada (`ssh-keygen -Y`), con lista de revocación |
| Consumo | Handles retenidos sobre archivos y ancestros; los datos viajan por stdin y se vuelven a hashear |
| Evidencia | Firmada por una clave distinta para cada rol: primario, recuperación y restauración |
| Volumen | BitLocker sobre el disco completo; no protege frente a procesos de la sesión abierta |
| Copias | Tres ubicaciones en discos físicos distintos: local, externa desconectada y fuera del sitio |
| Texto plano | Ninguno persistente fuera de un clúster sintético aislado |

| Script | Función |
|---|---|
| `01-Get-BackupInventory.ps1` | Metadatos, formato por cabecera y SHA-256. La salida no puede ir dentro de un árbol Git |
| `02-New-BackupIdentity.ps1` | Identidad `age` cifrada con passphrase y registro de su clave pública |
| `03-Protect-Backup.ps1` | Cifrado en una carpeta vacía; queda sin publicar |
| `04-Test-EncryptedBackup.ps1` | Posesión de la clave del rol, descifrado sin texto plano, `pg_restore` hacia `NUL` y evidencia |
| `05-Sign-BackupSet.ps1` | Verificación, firma y publicación |
| `06-Copy-BackupSet.ps1` | Copia verificada a otro disco |
| `07-Test-Vnbenc.ps1` | Recuperabilidad de archivos del formato anterior |
| `08-Test-RetirementGate.ps1` | `GO` / `NO_GO`; `NO_GO` termina con error |
| `09-Test-Restore.ps1` | Restauración de un conjunto **sintético** en un clúster aislado |

Ningún script elimina archivos.

## 2. Raíz de confianza

La raíz es independiente de los conjuntos: quien entrega un conjunto no puede cambiar a la vez la política y su pin.

1. Instalar los scripts revisados en una carpeta cuyo propietario sea Administrators, SYSTEM o TrustedInstaller y donde
   ningún otro principal pueda escribir, incluida la cuenta del operador sin elevar.
2. Crear `C:\ProgramData\VETNEB-H02\trust` con las mismas condiciones.
3. Colocar allí `trust-policy.json`, `allowed_signers` y `revoked_keys` (puede estar vacío).
4. Completar `$script:TrustPolicySha256` en el `Common.ps1` **instalado**. La copia del repositorio conserva el pin vacío
   y por eso falla cerrada.
5. Operar sin elevación. Una sesión elevada puede escribir la raíz y anula esta separación.

Los pasos 1 a 4 los hace un administrador. Ejecutar los scripts desde el repositorio es rechazado por ACL y pin.

### Política

| Campo | Contenido |
|---|---|
| `schema`, `epoch` | `1` y un entero que aumenta con cada rotación o revocación |
| `productionComputer` | Nombre del equipo productivo |
| `backupSigner` | Principal que firma conjuntos |
| `evidenceSigners` | Tres entradas `{principal, role, computer}` con roles `primary`, `recovery` y `restore` |
| `recipients` | `{primary, recovery}` |
| `custodians` | `{primary, recovery}`, distintos |
| `evidenceMaxAge` | `{days, status, approvedBy}` |
| `revokedSetIds` | Conjuntos revocados |
| `allowedSignersSha256`, `revokedKeysSha256` | Hashes de los dos archivos auxiliares |
| `tools.age` | `{directory, scan: ["."], files: {ruta relativa: sha256}}` |
| `tools.postgres` | `{directory, scan: ["bin","lib"], files: {...}}` |

`allowed_signers`: una línea por principal, sin comodines, con un único namespace:
`<principal> namespaces="vetneb-backup" ssh-ed25519 <clave>` para el firmante de conjuntos y `vetneb-evidence` para
los tres firmantes de evidencia. Se admiten `valid-after` y `valid-before`. Una clave no puede repetirse entre roles.

Cada `.exe` y `.dll` dentro de las carpetas de `scan` debe figurar en la política, y no puede faltar ninguno.

### Límites de procedencia

| Elemento | Qué se comprueba | Qué no está acreditado |
|---|---|---|
| `age` v1.3.2 | SHA-256 del ZIP y prueba Sigsum con la política `sigsum-generic-2025-1` | Que las claves firmantes pertenezcan a su autor: no hay canal independiente |
| `sigsum-verify` | Compilado localmente desde `sigsum-go` v0.13.1 | Hash de Go obtenido del mismo origen que la descarga |
| PostgreSQL | Inventario local de binarios | Los binarios no están firmados: autenticidad independiente no acreditada |
| `ssh-keygen` | Firma Authenticode del sistema | — |

En Windows, `sigsum-verify -P <nombre>` no encuentra las políticas embebidas en `sigsum-go` v0.13.1. Usar
`-p <archivo>` con la política cuyo contenido se haya contrastado.

**Vigencia de la evidencia: pendiente de aprobación.** La propuesta es `days: 7` con
`status: "PENDING_APPROVAL"` y `approvedBy` vacío. Mientras no pase a `APPROVED` con responsable, la puerta responde
`NO_GO`.

Procedencia: `ssh-keygen` se valida por su firma de Microsoft. Los binarios de PostgreSQL no están firmados; un hash
tomado de la instalación local solo detecta cambios posteriores. Antes de producción se contrastan con una descarga
oficial. Para `age`, SHA-256 de `age-v1.3.2-windows-amd64.zip` publicado por la API de GitHub el 2026-11-26, sin
verificación independiente:
`f48d8f8f9ebe903ab5027ed067652f2cc1db94bc206976430133b905dcd8e8c7`.

## 3. Publicación, integridad y durabilidad

Son garantías distintas.

| Propiedad | Cómo se obtiene | Límite |
|---|---|---|
| Publicación | La firma (`SHA256SUMS.txt.sig`, `<evidencia>.json.sig`) o el registro de identidad se escribe al final. Sin marca válida, no existe | No es un renombrado atómico: un parcial puede verse en disco, pero ningún consumidor lo acepta |
| Integridad | Cada consumidor verifica y lee desde los mismos handles; ningún directorio se renombra ni se liberan handles antes de publicar | No protege del administrador ni de un proceso que controle la sesión |
| Durabilidad | `Flush(true)` por archivo y relectura tras desconectar y reconectar el medio | El comportamiento ante un corte eléctrico no está demostrado |

Entre la creación de un archivo y su reapertura en solo lectura existe un intervalo; el contenido se compara después
sobre el handle retenido, que es el que cuenta.

## 4. Precondiciones y secuencia

Si falta una precondición, no empezar.

1. Ningún proceso con credenciales productivas abierto.
2. Autorización R3 escrita, con archivos y destinos nombrados.
3. Raíz de confianza instalada según §2.
4. PowerShell 7.4+, OpenSSH de Windows, PostgreSQL 17.10 y volúmenes NTFS.
5. Carpetas de claves, conjuntos, staging y evidencia fuera de árboles Git, del directorio de respaldos y de la raíz,
   con acceso solo para SYSTEM y el operador.
6. Pruebas de §6 en `PASSED`.

| # | Etapa | Script | Puerta de salida |
|---|---|---|---|
| 1 | Inventario | 01 | Hashes anotados fuera del equipo |
| 2 | Claves | 02 dos veces, más claves de firma | Custodia según §5 |
| 3 | Cifrado | 03 | Registro presente; conjunto sin publicar |
| 4 | Publicación | 05 | Firma verificada |
| 5 | Descifrado primario | 04 `-IdentityRole primary` | Evidencia firmada |
| 6 | Formato anterior | 07 | Hash igual al inventario |
| 7 | Copias | 06 | Relectura tras reconectar |
| 8 | Recuperación en otro equipo | 04 `-IdentityRole recovery` | Evidencia firmada desde una copia externa |
| 9 | Restauración sintética | 09 | Evidencia firmada del ensayo |
| 10 | Puerta | 08 | `GO` por cada original |
| 11 | Retiro del original | sin script | Autorización R3 específica posterior |

| Script | Parámetros |
|---|---|
| 01 | `-Root [-OutFile]` |
| 02 | `-KeyDir -Name` |
| 03 | `-Source -ExpectedSha256 -SetDir -DataClass synthetic\|production` |
| 04 | `-SetDir -ExpectedPlainSha256 -IdentityFile -IdentityRole -EvidenceDir -EvidenceSigningKey -StagingDir` |
| 05 | `-SetDir -ExpectedPlainSha256 -SigningKey -StagingDir` |
| 06 | `-SetDir -DestinationRoot` |
| 07 | `-CipherFile -ExpectedPlainSha256` |
| 08 | `-Original -ExpectedPlainSha256 -SetDirs "<a>;<b>;<c>" -EvidenceDir` |
| 09 | `-SetDir -ExpectedPlainSha256 -IdentityFile -IdentityRole -LabDir -Port -ExpectedRowCounts -EvidenceDir -EvidenceSigningKey -StagingDir` |

Claves de firma: `ssh-keygen -t ed25519` interactivo, **con** passphrase, sin `-N`, comprobando antes que el archivo no
existe. `ssh-keygen` de Windows agrega a Administrators en la clave privada y los scripts la rechazan. Restringir la
ACL de cada clave nueva a operador y SYSTEM:

```powershell
icacls <ruta de la clave> /inheritance:r /grant:r "*$([Security.Principal.WindowsIdentity]::GetCurrent().User.Value):F" "*S-1-5-18:F" /remove:g "*S-1-5-32-544"
```

### Puerta de retiro

`GO` exige simultáneamente: tres copias en tres discos; mismo conjunto cifrado y de la época vigente; vigencia
aprobada; custodios declarados distintos; descifrado primario; recuperación en otro equipo; y restauración aceptada.
Solo cuenta evidencia firmada, vigente, de la política actual y ligada al `setId`.

`09` admite únicamente conjuntos `synthetic`. Por eso **ningún respaldo productivo puede obtener `GO` hoy**: falta
diseñar y autorizar su restauración aislada. Es un bloqueo deliberado. `GO` tampoco autoriza borrar.

### Restauración sintética

`09` descifra por completo sin salida, crea un clúster nuevo en una carpeta vacía en `127.0.0.1`, confirma su
`data_directory`, restaura con un rol sin privilegios en una base de cuarentena y compara bytes y hash entre `age` y
`pg_restore`. Solo entonces valida filas y renombra la base a `accepted_*`. «Aceptar» no publica ni modifica ninguna
base real.

`--single-transaction` no basta: `age` entrega bloques antes de detectar un truncamiento. Una base `quarantine_*` es
inválida. El clúster y su contraseña sintética de administración permanecen en disco hasta una limpieza autorizada. No
usar `age -o` hacia texto plano persistente: sobrescribe y deja salidas parciales.

La contraseña del rol de restauración no viaja en argumentos: `09` envía solo su verificador SCRAM por la entrada
estándar de `psql`, sin registrar la sentencia en el log del clúster. `pg_restore` la recibe por variable de entorno,
visible para otro proceso del mismo usuario.

El nombre `synthetic` lo declara quien cifra; la criptografía no puede comprobar que los datos sean inventados.

### Restauración sintética frente a recuperación

| | Ensayo sintético (`09`) | Recuperación productiva |
|---|---|---|
| Datos | Inventados, volumen pequeño | Reales, con sus dependencias |
| Alcance | Un esquema de prueba en un clúster desechable | Base, Storage, roles, configuración, aplicación |
| Estado | Verificable en laboratorio | **No diseñada, no autorizada y no verificada** |

Una duración medida en el ensayo no acredita ningún RTO ni RPO. Aceptar una base sintética no demuestra que un
respaldo real sea restaurable.

## 5. Claves, custodia y recuperación

| Elemento | Custodia primaria | Copia de recuperación |
|---|---|---|
| Identidad primaria cifrada | Carpeta de claves restringida | Medio removible distinto de las copias de datos |
| Passphrase primaria | Gestor de contraseñas accesible desde otro dispositivo | Papel sellado en otro lugar |
| Identidad de recuperación | Medio removible; no permanece en el equipo productivo | Segundo medio en otro lugar |
| Passphrase de recuperación (distinta) | Papel sellado | Entrada separada del gestor |
| Clave de firma de conjuntos | Carpeta de claves restringida | Medio removible |
| Claves de evidencia | Una por rol, en el equipo de ese rol | Se reemplazan por rotación, no se copian |
| Raíz de confianza | Equipo, escribible solo por administradores | Copia y pin fuera del equipo |
| Clave de recuperación BitLocker | Fuera del disco cifrado | Papel |

- Ninguna ubicación reúne cifrados, identidad y passphrase.
- Las passphrases se escriben solo en una consola propia: nunca en argumentos, archivos, logs, repositorio, chat ni
  terminales visibles para agentes. No dejar vacía la passphrase de `age`: la autogenerada se imprime en pantalla.
- Cada identidad contiene exactamente una clave; 04 lo comprueba derivando la pública.
- Dos claves distintas prueban independencia criptográfica, **no** custodios independientes. `custodians` es una
  declaración. Falta designar custodio suplente.

### Rotación, revocación y emergencia

| Situación | Acción |
|---|---|
| Rotación anual o cambio de custodio | Claves nuevas, política con `epoch` mayor, pin nuevo, recifrado verificado. La evidencia anterior deja de valer |
| Compromiso de una clave de firma | Agregarla a `revoked_keys`, retirar su línea, subir `epoch`, volver a firmar desde el origen verificado |
| Compromiso de una identidad `age` | `age` no revoca: claves nuevas, recifrado, `revokedSetIds`, retiro autorizado de lo viejo y dar por expuesto lo copiable |
| Conjunto sospechoso | Agregar su `setId` a `revokedSetIds`; 04, 06, 08 y 09 lo rechazan |
| Recuperación de un conjunto de una época anterior | Restaurar, con administrador y autorización, la política archivada de esa época; registrar y volver a la vigente |
| Pérdida de la raíz de confianza | Reinstalar desde la copia externa y su pin; nunca desde el medio que trae el conjunto |

Conservar identidades y políticas archivadas mientras algún respaldo dependa de ellas. Vigencia, época y revocación
acotan la reutilización de evidencia, pero no la impiden dentro de la ventana: no hay registro externo de solo anexado.

Recuperación en otro equipo: equipo confiable y cifrado; instalar versiones aprobadas y la raíz de confianza por una
vía independiente; obtener un conjunto externo; ejecutar 04 con la identidad y la clave de evidencia de recuperación.
Prueba trimestral.

## 6. Pruebas

Los arneses están en [`scripts/ops/backup-encryption/tests/`](../../scripts/ops/backup-encryption/tests/). No usan
Pester ni dependencias. Terminan con error si algún caso queda en `FAILED` o `BLOCKED`; por eso una corrida correcta
con casos bloqueados por recursos también termina con código distinto de cero, y hay que leer la tabla de resultados.

```powershell
pwsh -NoProfile -File .\scripts\ops\backup-encryption\tests\Invoke-Tests.ps1
```

| Modo | Cubre | Autorización |
|---|---|---|
| `Invoke-Tests.ps1` | S01–S03, R03, T01a, T03a, T05a, T05c, T06, T07p, T09a, T11a, T11b, T12a. No crea archivos | Validación local |
| `Invoke-Tests.ps1 -LabRoot` | Agrega T01b, T03b, T05b, T05d, T07a, T07c, T11c, T14, F01, F07. Crea carpetas, ACL, junctions y claves desechables | Laboratorio autorizado |
| `Invoke-InteractiveTests.ps1 -AuthorizedLab -LabRoot -AgeDir` | T02, T04, T07–T10, T13, T15–T19. Inicia clústeres sintéticos | Instalación de `age` y clústeres autorizados |
| Lo anterior más `-SecondDiskRoot <carpeta> -AuthorizedSecondDisk` | T07b | Autorización que nombre el disco y el destino |

| Caso | Qué fija |
|---|---|
| T05d | Una carpeta restringida bajo un ancestro que permite borrarla a `Everyone` se rechaza |
| R03 | La contraseña del rol no llega a argumentos ni sentencias en claro; el verificador cumple el vector del RFC 7677 |
| F01 | `01` sobre archivos inventados: formatos, hashes, sin sobrescritura, sin raíces prohibidas ni junctions |
| F07 | `07` sobre un `VNBENC1` construido según el formato descrito: recupera el sano y rechaza ocho variantes |
| T16–T19 | Fallos de `initdb`, `pg_ctl`, `psql` y de publicación de evidencia: nada queda aceptado |

### Passphrase automática (`-AutoPassphrase`)

Solo para el arnés y solo con material sintético creado por la misma corrida.

- Genera una passphrase aleatoria en memoria; no se puede suministrar desde fuera y no se guarda. Las claves de esa
  corrida quedan inutilizables al terminar.
- `age` y `ssh-keygen` siguen leyendo de la consola: el arnés escribe las teclas cuando cada pedido está en pantalla.
  `ssh-keygen` de Windows descarta lo escrito antes de su pedido.
- No pasa por argumentos, variables de entorno ni archivos; T15 busca su ausencia en los archivos de la corrida.
- Otro proceso del mismo usuario puede leerla de la memoria o de la consola. `LabConsole` escribe teclas en la consola
  actual: usar una consola dedicada.
- No prueba la escritura física por una persona. El modo manual (sin el parámetro) sigue disponible.
- Está prohibido usarla con identidades, claves o respaldos reales.

### Límites de T15

T15 revisa los archivos de la carpeta de la corrida, salvo el origen sintético, los clústeres, los scripts y los
binarios: busca archivos que **empiecen** como un dump y claves privadas de `age`. **No** revisa `TEMP`, memoria,
paginación, hibernación, sectores libres, instantáneas ni otros discos, y no detecta texto plano transformado o
incrustado. No demuestra ausencia de texto plano en el equipo.

### T07b: segundo disco físico

Precondiciones: otro disco físico con volumen NTFS (no una partición del mismo disco, VHD, Storage Spaces, red ni
`subst`); una carpeta de destino vacía cuyo acceso sea solo de operador y SYSTEM y cuyos ancestros, incluida la raíz
del volumen, no permitan a terceros borrar ni cambiar permisos; consola visible. Un volumen nuevo suele permitir
`Modify` a usuarios autenticados en la raíz: corregirlo requiere administrador y autorización.

El caso comprueba la independencia, copia y verifica firma y hashes, rechaza la repetición, interrumpe `06` antes de
publicar la firma, rechaza el parcial, y pide expulsar y reconectar el medio con la misma letra antes de releer. Sin
dispositivo o sin autorización queda `BLOCKED`. Dentro de una máquina virtual la comprobación no puede demostrar
independencia física.

### Bloqueos y límites

Pendientes de recursos: T07b (segundo disco), `GO` real (tres discos), recuperación en otro equipo y disco lleno real
(T20, volumen dedicado). No ejercitados: fallo de `pg_ctl stop` y escritura física de passphrases.

### Integración en CI (propuesta, no incluida)

CI no ejecuta estos scripts: un resultado verde no los valida. La integración va en un cambio separado: un job de
Windows, inicialmente no requerido, que ejecute `Invoke-Tests.ps1` sin parámetros y compruebe por identificador que
solo queden `BLOCKED` los casos de laboratorio. `-LabRoot` en un runner requiere validar antes los casos de ACL con
una cuenta elevada. El arnés interactivo queda fuera: necesita `age` fijado, consola y clústeres.

## 7. Interrupciones y suspensión

Hasta el retiro todo es aditivo. Tras un fallo pueden quedar cifrados sin registro, registros o listas sin firma,
identidades sin registro, archivos en staging o bases en cuarentena: se anotan como inválidos, no se reutilizan y su
retiro requiere autorización. Para reintentar se usa una carpeta nueva.

Suspender si difiere un hash o un pin, cambia el origen, falla firma, descifrado o `pg_restore`, la ACL difiere, el
destino existe, la versión o un binario no son los aprobados, hay un proceso productivo abierto, aparece texto plano
inesperado o hay duda sobre la custodia.

## 8. Riesgos residuales

- Un proceso malicioso del mismo usuario puede capturar passphrases, leer memoria o archivos de secreto.
- Un administrador puede alterar scripts, política, binarios y pin.
- La comprobación de ACL de ancestros no cubre privilegios como Backup o Restore.
- Rol, equipo y clase de datos son declaraciones ligadas a una clave, no pruebas físicas.
- Discos virtuales alojados en un mismo disco pueden contar como independientes.
- La memoria de .NET y de los procesos no garantiza borrar todas las copias de un secreto.
- El nivel 1 de verificación (hash) no prueba que el dump original estuviera completo.
- El ensayo de restauración deja en disco la contraseña sintética de administración del clúster.
- El código de pruebas incluye un inyector de teclas de consola para la passphrase sintética; ningún script de
  operación lo referencia.

## 9. Autorizaciones R3

Cada una nombra entorno y objetivo: instalar herramientas; crear carpetas y fijar permisos; instalar la raíz de
confianza; generar claves definitivas; leer, cifrar, descifrar o inventariar respaldos reales; copiar fuera del equipo;
recuperar en otro equipo; activar cifrado de volumen; iniciar clústeres de ensayo; retirar cualquier original o
parcial; restaurar; rotar credenciales tras un incidente.

## 10. Criterios de aceptación

1. Cada respaldo del alcance tiene un cifrado firmado en tres discos, con el mismo `setId` y SHA-256.
2. Descifrado primario con hash y tamaño iguales al inventario.
3. Descifrado con la identidad de recuperación en otro equipo, desde una copia externa.
4. `pg_restore` 17.10 recorre cada archivo.
5. Restauración aislada observada, con duración medida contra el RTO.
6. Pruebas de §6 en `PASSED`.
7. Archivos del formato anterior probados, o declarados no recuperables.
8. Claves y raíz de confianza custodiadas según §5, con relectura confirmada.
9. Sin texto plano en el alcance y cifrado de volumen confirmado con privilegios.
10. Copias históricas referenciadas localizadas y protegidas, o declaradas perdidas o eliminadas.
11. Acta privada con entorno, hora UTC, operador, resultados y riesgos.

Con cualquier punto pendiente el hallazgo sigue abierto. Cumplirlos no demuestra recuperación ante desastres.
