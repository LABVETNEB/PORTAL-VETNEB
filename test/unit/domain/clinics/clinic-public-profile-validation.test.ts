import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_CLINIC_PUBLIC_AVATAR_FILE_SIZE_BYTES,
  isClinicPublicAvatarMimeType,
  parseClinicPublicProfilePatch,
  validateClinicPublicAvatar,
  type ClinicPublicAvatarFile,
} from "../../../../server/features/clinics/domain/index.ts";

function buildPngBuffer(
  width: number,
  height: number,
  length = 24,
) {
  const buffer = Buffer.alloc(length);
  Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a,
    0x0a,
  ]).copy(buffer);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

function buildJpegBuffer(width: number, height: number) {
  const buffer = Buffer.alloc(13);
  buffer[0] = 0xff;
  buffer[1] = 0xd8;
  buffer[2] = 0xff;
  buffer[3] = 0xc0;
  buffer.writeUInt16BE(9, 4);
  buffer[6] = 8;
  buffer.writeUInt16BE(height, 7);
  buffer.writeUInt16BE(width, 9);
  return buffer;
}

function buildWebpVp8xBuffer(
  width: number,
  height: number,
) {
  const buffer = Buffer.alloc(30);
  buffer.write("RIFF", 0, "ascii");
  buffer.write("WEBP", 8, "ascii");
  buffer.write("VP8X", 12, "ascii");
  buffer.writeUIntLE(width - 1, 24, 3);
  buffer.writeUIntLE(height - 1, 27, 3);
  return buffer;
}

function buildWebpVp8lBuffer(
  width: number,
  height: number,
) {
  const buffer = Buffer.alloc(30);
  const widthBits = width - 1;
  const heightBits = height - 1;
  buffer.write("RIFF", 0, "ascii");
  buffer.write("WEBP", 8, "ascii");
  buffer.write("VP8L", 12, "ascii");
  buffer[20] = 0x2f;
  buffer[21] = widthBits & 0xff;
  buffer[22] =
    ((widthBits >> 8) & 0x3f) |
    ((heightBits & 0x03) << 6);
  buffer[23] = (heightBits >> 2) & 0xff;
  buffer[24] = (heightBits >> 10) & 0x0f;
  return buffer;
}

function buildWebpVp8Buffer(
  width: number,
  height: number,
) {
  const buffer = Buffer.alloc(31);
  buffer.write("RIFF", 0, "ascii");
  buffer.write("WEBP", 8, "ascii");
  buffer.write("VP8 ", 12, "ascii");
  buffer[23] = 0x9d;
  buffer[24] = 0x01;
  buffer[25] = 0x2a;
  buffer.writeUInt16LE(width, 26);
  buffer.writeUInt16LE(height, 28);
  return buffer;
}

function avatar(
  overrides: Partial<ClinicPublicAvatarFile> = {},
): ClinicPublicAvatarFile {
  return {
    buffer: buildPngBuffer(256, 256),
    originalname: "avatar.png",
    mimetype: "image/png",
    ...overrides,
  };
}

test("normaliza todos los campos PATCH y conserva el orden del shape", () => {
  const parsed = parseClinicPublicProfilePatch({
    displayName: " Clínica Norte ",
    aboutText: " Descripción ",
    specialtyText: " Cardiología ",
    servicesText: " Consultas ",
    email: " contacto@example.test ",
    phone: " 3410000000 ",
    publicAddress: " Calle 1 ",
    mapLink: " https://maps.google.com/?q=rosario ",
    locality: " Rosario ",
    country: " AR ",
    isPublic: " SÍ ",
  });

  assert.deepEqual(parsed, {
    ok: true,
    data: {
      displayName: "Clínica Norte",
      aboutText: "Descripción",
      specialtyText: "Cardiología",
      servicesText: "Consultas",
      email: "contacto@example.test",
      phone: "3410000000",
      publicAddress: "Calle 1",
      mapLink: "https://maps.google.com/?q=rosario",
      locality: "Rosario",
      country: "AR",
      isPublic: true,
    },
  });
});

test("normaliza vacío a null, tipos no string a undefined y trunca en límites exactos", () => {
  const parsed = parseClinicPublicProfilePatch({
    displayName: "x".repeat(256),
    aboutText: "x".repeat(5001),
    specialtyText: "x".repeat(501),
    servicesText: "x".repeat(5001),
    email: "x".repeat(256),
    phone: "x".repeat(51),
    publicAddress: "x".repeat(161),
    mapLink: 42,
    locality: "x".repeat(256),
    country: "   ",
    isPublic: 1,
  });

  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  assert.equal(parsed.data.displayName?.length, 255);
  assert.equal(parsed.data.aboutText?.length, 5000);
  assert.equal(parsed.data.specialtyText?.length, 500);
  assert.equal(parsed.data.servicesText?.length, 5000);
  assert.equal(parsed.data.email?.length, 255);
  assert.equal(parsed.data.phone?.length, 50);
  assert.equal(parsed.data.publicAddress?.length, 160);
  assert.equal(parsed.data.mapLink, undefined);
  assert.equal(parsed.data.locality?.length, 255);
  assert.equal(parsed.data.country, null);
  assert.equal(parsed.data.isPublic, undefined);
});

test("parsea todas las variantes booleanas y deja inválidas como undefined", () => {
  const cases: Array<[unknown, boolean | undefined]> = [
    [true, true],
    [false, false],
    ["true", true],
    ["1", true],
    ["si", true],
    ["sí", true],
    ["false", false],
    ["0", false],
    ["no", false],
    ["maybe", undefined],
    [null, undefined],
  ];

  for (const [value, expected] of cases) {
    const parsed = parseClinicPublicProfilePatch({
      isPublic: value,
    });
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.data.isPublic, expected);
    }
  }
});

test("rechaza HTML de dirección antes que un mapLink inválido", () => {
  assert.deepEqual(
    parseClinicPublicProfilePatch({
      publicAddress: "<b>Calle</b>",
      mapLink: "not-a-url",
    }),
    {
      ok: false,
      error:
        "La dirección pública no puede contener HTML.",
    },
  );
});

test("acepta la allowlist real de mapas y normaliza las URLs", () => {
  for (const mapLink of [
    "https://maps.google.com/?q=rosario",
    "https://maps.app.goo.gl/abc",
    "https://openstreetmap.org/node/1",
    "https://www.openstreetmap.org/node/1",
    "https://google.com/maps/place/Rosario",
    "https://www.google.com/maps?q=rosario",
    "https://goo.gl/maps/abc",
  ]) {
    const parsed = parseClinicPublicProfilePatch({
      mapLink,
    });
    assert.equal(parsed.ok, true, mapLink);
    if (parsed.ok) {
      assert.equal(
        typeof parsed.data.mapLink,
        "string",
        mapLink,
      );
    }
  }
});

test("rechaza URL malformada, protocolo inseguro, host y path no permitidos", () => {
  const cases = [
    [
      "not-a-url",
      "El enlace a mapa debe ser una URL válida con https://.",
    ],
    [
      "http://maps.google.com/?q=rosario",
      "El enlace a mapa debe usar https://.",
    ],
    [
      "javascript:alert(1)",
      "El enlace a mapa debe usar https://.",
    ],
    [
      "https://example.com/maps",
      "El enlace a mapa debe usar dominios de mapas permitidos (Google Maps u OpenStreetMap).",
    ],
    [
      "https://google.com/not-maps",
      "El enlace a mapa debe usar dominios de mapas permitidos (Google Maps u OpenStreetMap).",
    ],
    [
      "https://goo.gl/not-maps",
      "El enlace a mapa debe usar dominios de mapas permitidos (Google Maps u OpenStreetMap).",
    ],
  ] as const;

  for (const [mapLink, error] of cases) {
    assert.deepEqual(
      parseClinicPublicProfilePatch({ mapLink }),
      {
        ok: false,
        error,
      },
    );
  }
});

test("acepta mapLink vacío como null", () => {
  assert.deepEqual(
    parseClinicPublicProfilePatch({ mapLink: "   " }),
    {
      ok: true,
      data: {
        displayName: undefined,
        aboutText: undefined,
        specialtyText: undefined,
        servicesText: undefined,
        email: undefined,
        phone: undefined,
        publicAddress: undefined,
        mapLink: null,
        locality: undefined,
        country: undefined,
        isPublic: undefined,
      },
    },
  );
});

test("reconoce sólo los MIME admitidos", () => {
  assert.equal(
    isClinicPublicAvatarMimeType("image/jpeg"),
    true,
  );
  assert.equal(
    isClinicPublicAvatarMimeType("image/png"),
    true,
  );
  assert.equal(
    isClinicPublicAvatarMimeType("image/webp"),
    true,
  );
  assert.equal(
    isClinicPublicAvatarMimeType("image/gif"),
    false,
  );
  assert.equal(
    isClinicPublicAvatarMimeType("IMAGE/PNG"),
    false,
  );
});

test("valida PNG, JPEG y las tres variantes WebP", () => {
  const validFiles: ClinicPublicAvatarFile[] = [
    avatar(),
    avatar({
      buffer: buildJpegBuffer(256, 256),
      originalname: "avatar.jpeg",
      mimetype: "image/jpeg",
    }),
    avatar({
      buffer: buildWebpVp8xBuffer(256, 256),
      originalname: "avatar.webp",
      mimetype: "image/webp",
    }),
    avatar({
      buffer: buildWebpVp8lBuffer(256, 256),
      originalname: "avatar.webp",
      mimetype: "image/webp",
    }),
    avatar({
      buffer: buildWebpVp8Buffer(256, 256),
      originalname: "avatar.webp",
      mimetype: "image/webp",
    }),
  ];

  for (const file of validFiles) {
    assert.deepEqual(validateClinicPublicAvatar(file), {
      error: null,
    });
  }
});

test("rechaza MIME y extensión no admitidos con precedencia estable", () => {
  assert.deepEqual(
    validateClinicPublicAvatar(
      avatar({
        originalname: "avatar.gif",
        mimetype: "image/gif",
      }),
    ),
    {
      error: "La imagen debe ser JPG, PNG o WebP.",
    },
  );
  assert.deepEqual(
    validateClinicPublicAvatar(
      avatar({ originalname: "avatar.gif" }),
    ),
    {
      error: "La imagen debe ser JPG, PNG o WebP.",
    },
  );
});

test("acepta 512 KiB exactos y rechaza el byte adyacente", () => {
  assert.deepEqual(
    validateClinicPublicAvatar(
      avatar({
        buffer: buildPngBuffer(
          256,
          256,
          MAX_CLINIC_PUBLIC_AVATAR_FILE_SIZE_BYTES,
        ),
      }),
    ),
    { error: null },
  );

  assert.deepEqual(
    validateClinicPublicAvatar(
      avatar({
        buffer: buildPngBuffer(
          256,
          256,
          MAX_CLINIC_PUBLIC_AVATAR_FILE_SIZE_BYTES + 1,
        ),
      }),
    ),
    {
      error: "La imagen no debe superar 512 KB.",
    },
  );
});

test("rechaza contenido cuya firma no coincide con el MIME declarado", () => {
  assert.deepEqual(
    validateClinicPublicAvatar(
      avatar({
        buffer: buildJpegBuffer(256, 256),
      }),
    ),
    {
      error:
        "No se pudieron validar las dimensiones de la imagen.",
    },
  );
  assert.deepEqual(
    validateClinicPublicAvatar(
      avatar({
        buffer: buildPngBuffer(256, 256),
        originalname: "avatar.jpg",
        mimetype: "image/jpeg",
      }),
    ),
    {
      error:
        "No se pudieron validar las dimensiones de la imagen.",
    },
  );
});

test("fija límites de dimensiones 159/160/1024/1025", () => {
  const cases = [
    [
      159,
      160,
      "La imagen debe tener al menos 160 x 160 px.",
    ],
    [160, 160, null],
    [1024, 1024, null],
    [
      1025,
      1024,
      "La imagen no debe superar 1024 x 1024 px.",
    ],
  ] as const;

  for (const [width, height, error] of cases) {
    assert.deepEqual(
      validateClinicPublicAvatar(
        avatar({
          buffer: buildPngBuffer(width, height),
        }),
      ),
      { error },
    );
  }
});

test("fija ratios 0.84/0.85/1.15/1.16", () => {
  const cases = [
    [
      168,
      200,
      "Se recomienda una imagen cuadrada para evitar recortes.",
    ],
    [170, 200, null],
    [230, 200, null],
    [
      232,
      200,
      "Se recomienda una imagen cuadrada para evitar recortes.",
    ],
  ] as const;

  for (const [width, height, error] of cases) {
    assert.deepEqual(
      validateClinicPublicAvatar(
        avatar({
          buffer: buildPngBuffer(width, height),
        }),
      ),
      { error },
    );
  }
});

test("rechaza buffers truncados de PNG, JPEG y WebP sin lanzar", () => {
  const truncated = [
    avatar({ buffer: Buffer.alloc(23) }),
    avatar({
      buffer: Buffer.from([0xff, 0xd8, 0xff]),
      originalname: "avatar.jpg",
      mimetype: "image/jpeg",
    }),
    avatar({
      buffer: Buffer.from("RIFF____WEBPVP8X", "ascii"),
      originalname: "avatar.webp",
      mimetype: "image/webp",
    }),
  ];

  for (const file of truncated) {
    assert.deepEqual(
      validateClinicPublicAvatar(file),
      {
        error:
          "No se pudieron validar las dimensiones de la imagen.",
      },
    );
  }
});
