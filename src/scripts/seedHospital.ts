import mongoose, { Types } from 'mongoose';
import { env } from '../config/env';
import { UserModel } from '../models/User.model';
import { DepartmentModel } from '../models/Department.model';
import { ScheduleModel, IWorkingDay } from '../models/Schedule.model';
import { PatientModel } from '../models/Patient.model';
import { AppointmentModel } from '../models/Appointment.model';
import { CounterModel } from '../models/Counter.model';
import { ROLES } from '../constants/roles';
import { hashPassword } from '../utils/password.util';
import { normalizePhoneNumber } from '../utils/phone.util';
import { logger } from '../utils/logger';

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getOffsetDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return formatDate(d);
}

function buildDefaultWorkingDays(): IWorkingDay[] {
  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const workingDays: IWorkingDay[] = [];

  for (let i = 0; i <= 6; i++) {
    const isWeekday = i >= 1 && i <= 5; // Monday to Friday
    workingDays.push({
      dayOfWeek: i,
      dayName: dayNames[i]!,
      isEnabled: isWeekday,
      sessions: isWeekday
        ? [{ startTime: '09:00', endTime: '17:00', label: 'Regular OPD' }]
        : [],
      breaks: isWeekday
        ? [{ startTime: '13:00', endTime: '14:00', label: 'Lunch Break' }]
        : [],
    });
  }

  return workingDays;
}

async function seedHospital(): Promise<void> {
  try {
    logger.info('Connecting to MongoDB database...');
    await mongoose.connect(env.MONGODB_URI);
    logger.info('MongoDB connected successfully. Beginning idempotent seed...');

    const defaultDoctorPassword = await hashPassword('Doctor@123');
    const defaultRecepPassword = await hashPassword('Recep@123');
    const superAdminPassword = await hashPassword(env.SUPER_ADMIN_PASSWORD || 'Admin@12345');

    // -------------------------------------------------------------
    // 1. SUPER ADMIN
    // -------------------------------------------------------------
    const adminEmail = (env.SUPER_ADMIN_EMAIL || 'admin@hospital.com').toLowerCase().trim();
    let admin = await UserModel.findOne({ email: adminEmail });
    if (!admin) {
      admin = await UserModel.create({
        name: env.SUPER_ADMIN_NAME || 'Hospital Super Admin',
        email: adminEmail,
        password: superAdminPassword,
        role: ROLES.SUPER_ADMIN,
        isActive: true,
        isActivated: true,
      });
      logger.info(`Super Admin created: ${adminEmail}`);
    } else {
      admin.password = superAdminPassword;
      admin.isActive = true;
      admin.isActivated = true;
      await admin.save();
      logger.info(`Super Admin updated and active: ${adminEmail}`);
    }

    // -------------------------------------------------------------
    // 2. DEPARTMENTS
    // -------------------------------------------------------------
    // Find or create Cardiology
    let cardio = await DepartmentModel.findOne({
      $or: [{ code: 'CARD' }, { code: 'CARDIO' }, { name: 'Cardiology' }],
    });
    if (!cardio) {
      cardio = await DepartmentModel.create({
        name: 'Cardiology',
        code: 'CARD',
        description: 'Heart and cardiovascular system care',
        isActive: true,
      });
    }

    // Find or create Neurology
    let neuro = await DepartmentModel.findOne({
      $or: [{ code: 'NEUR' }, { code: 'NEURO' }, { name: 'Neurology' }],
    });
    if (!neuro) {
      neuro = await DepartmentModel.create({
        name: 'Neurology',
        code: 'NEUR',
        description: 'Disorders of the brain, spinal cord, and nerves',
        isActive: true,
      });
    }

    // Find or create Orthopedics
    let ortho = await DepartmentModel.findOne({
      $or: [{ code: 'ORTH' }, { name: 'Orthopedics' }],
    });
    if (!ortho) {
      ortho = await DepartmentModel.create({
        name: 'Orthopedics',
        code: 'ORTH',
        description: 'Musculoskeletal system, bones, and joints',
        isActive: true,
      });
    }

    // Find or create Pediatrics
    let peds = await DepartmentModel.findOne({
      $or: [{ code: 'PEDI' }, { name: 'Pediatrics' }],
    });
    if (!peds) {
      peds = await DepartmentModel.create({
        name: 'Pediatrics',
        code: 'PEDI',
        description: 'Medical care of infants, children, and adolescents',
        isActive: true,
      });
    }

    // Find or create Dermatology
    let derm = await DepartmentModel.findOne({
      $or: [{ code: 'DERM' }, { name: 'Dermatology' }],
    });
    if (!derm) {
      derm = await DepartmentModel.create({
        name: 'Dermatology',
        code: 'DERM',
        description: 'Skin, hair, nail conditions and cosmetic treatments',
        isActive: true,
      });
    }

    logger.info('Departments verified: Cardiology, Neurology, Orthopedics, Pediatrics, Dermatology');

    // -------------------------------------------------------------
    // 3. RECEPTIONISTS (1 ACTIVE PER DEPARTMENT)
    // -------------------------------------------------------------
    const receptionistConfigs = [
      {
        email: 'anshida22@gmail.com',
        name: 'Anshida',
        department: cardio._id,
      },
      {
        email: 'lisin@gmail.com',
        name: 'Lisin',
        department: neuro._id,
      },
      {
        email: 'sarah.ortho@hospital.com',
        name: 'Sarah Jenkins',
        department: ortho._id,
      },
      {
        email: 'emily.peds@hospital.com',
        name: 'Emily Watson',
        department: peds._id,
      },
      {
        email: 'david.derm@hospital.com',
        name: 'David Miller',
        department: derm._id,
      },
    ];

    const receptionistMap = new Map<string, Types.ObjectId>();

    for (const rc of receptionistConfigs) {
      let user = await UserModel.findOne({ email: rc.email.toLowerCase() });
      if (!user) {
        user = await UserModel.create({
          name: rc.name,
          email: rc.email.toLowerCase(),
          password: defaultRecepPassword,
          role: ROLES.RECEPTIONIST,
          department: rc.department,
          isActive: true,
          isActivated: true,
        });
        logger.info(`Created Receptionist: ${rc.name} (${rc.email})`);
      } else {
        user.name = rc.name;
        user.department = rc.department;
        user.password = defaultRecepPassword;
        user.isActive = true;
        user.isActivated = true;
        await user.save();
        logger.info(`Updated Receptionist: ${rc.name} (${rc.email})`);
      }
      receptionistMap.set(rc.email.toLowerCase(), user._id);
    }

    // -------------------------------------------------------------
    // 4. DOCTORS (2 PER DEPARTMENT)
    // -------------------------------------------------------------
    const doctorConfigs = [
      // Cardiology
      {
        email: 'najathmuhammad22@gmail.com',
        name: 'Dr. Najath',
        department: cardio._id,
        specialization: 'Interventional Cardiology',
      },
      {
        email: 'chase@hospital.com',
        name: 'Dr. Robert Chase',
        department: cardio._id,
        specialization: 'General Cardiology',
      },
      // Neurology
      {
        email: 'jhoney@gmail.com',
        name: 'Dr. Jhoney',
        department: neuro._id,
        specialization: 'Clinical Neurology',
      },
      {
        email: 'foreman@hospital.com',
        name: 'Dr. Eric Foreman',
        department: neuro._id,
        specialization: 'Neurophysiology',
      },
      // Orthopedics
      {
        email: 'wilson.ortho@hospital.com',
        name: 'Dr. James Wilson',
        department: ortho._id,
        specialization: 'Joint Replacement & Trauma',
      },
      {
        email: 'torres.ortho@hospital.com',
        name: 'Dr. Callie Torres',
        department: ortho._id,
        specialization: 'Pediatric Orthopedics',
      },
      // Pediatrics
      {
        email: 'robbins.peds@hospital.com',
        name: 'Dr. Arizona Robbins',
        department: peds._id,
        specialization: 'General Pediatrics',
      },
      {
        email: 'karev.peds@hospital.com',
        name: 'Dr. Alex Karev',
        department: peds._id,
        specialization: 'Neonatology',
      },
      // Dermatology
      {
        email: 'sloan.derm@hospital.com',
        name: 'Dr. Mark Sloan',
        department: derm._id,
        specialization: 'Clinical Dermatology',
      },
      {
        email: 'avery.derm@hospital.com',
        name: 'Dr. Jackson Avery',
        department: derm._id,
        specialization: 'Cosmetic & Laser Surgery',
      },
    ];

    const doctorMap = new Map<string, Types.ObjectId>();

    for (const dc of doctorConfigs) {
      let doctor = await UserModel.findOne({ email: dc.email.toLowerCase() });
      if (!doctor) {
        doctor = await UserModel.create({
          name: dc.name,
          email: dc.email.toLowerCase(),
          password: defaultDoctorPassword,
          role: ROLES.DOCTOR,
          department: dc.department,
          specialization: dc.specialization,
          isActive: true,
          isActivated: true,
        });
        logger.info(`Created Doctor: ${dc.name} (${dc.email})`);
      } else {
        doctor.name = dc.name;
        doctor.department = dc.department;
        doctor.specialization = dc.specialization;
        doctor.password = defaultDoctorPassword;
        doctor.isActive = true;
        doctor.isActivated = true;
        await doctor.save();
        logger.info(`Updated Doctor: ${dc.name} (${dc.email})`);
      }
      doctorMap.set(dc.email.toLowerCase(), doctor._id);

      // Create / Update Doctor Schedule
      const defaultWorkingDays = buildDefaultWorkingDays();
      let schedule = await ScheduleModel.findOne({ doctor: doctor._id });
      if (!schedule) {
        schedule = await ScheduleModel.create({
          doctor: doctor._id,
          slotDuration: 30,
          workingDays: defaultWorkingDays,
          isActive: true,
        });
        logger.info(`Configured weekly schedule for ${dc.name}`);
      } else {
        schedule.workingDays = defaultWorkingDays;
        schedule.slotDuration = 30;
        schedule.isActive = true;
        await schedule.save();
        logger.info(`Updated weekly schedule for ${dc.name}`);
      }
    }

    // -------------------------------------------------------------
    // 5. PATIENTS
    // -------------------------------------------------------------
    const primaryRegistrarId = receptionistMap.get('anshida22@gmail.com') || admin._id;

    const patientConfigs = [
      {
        patientId: 'PAT-2026-00001',
        fullName: 'Johnathan Doe',
        phone: '+1 (555) 111-2222',
        dateOfBirth: '1985-03-20',
        gender: 'MALE' as const,
        department: cardio._id,
      },
      {
        patientId: 'PAT-2026-00002',
        fullName: 'Alice Smith',
        phone: '+1 (555) 333-4444',
        dateOfBirth: '1992-07-11',
        gender: 'FEMALE' as const,
        department: neuro._id,
      },
      {
        patientId: 'PAT-2026-00003',
        fullName: 'Bob Johnson',
        phone: '+1 (555) 555-6666',
        dateOfBirth: '1978-11-05',
        gender: 'MALE' as const,
        department: ortho._id,
      },
      {
        patientId: 'PAT-2026-00004',
        fullName: 'Emma Watson',
        phone: '+1 (555) 777-8888',
        dateOfBirth: '1995-04-15',
        gender: 'FEMALE' as const,
        department: peds._id,
      },
      {
        patientId: 'PAT-2026-00005',
        fullName: 'Michael Brown',
        phone: '+1 (555) 222-3333',
        dateOfBirth: '1980-09-28',
        gender: 'MALE' as const,
        department: derm._id,
      },
      {
        patientId: 'PAT-2026-00006',
        fullName: 'Sophia Garcia',
        phone: '+1 (555) 444-5555',
        dateOfBirth: '2002-12-03',
        gender: 'FEMALE' as const,
        department: cardio._id,
      },
      {
        patientId: 'PAT-2026-00007',
        fullName: 'William Davis',
        phone: '+1 (555) 888-9999',
        dateOfBirth: '1968-06-19',
        gender: 'MALE' as const,
        department: ortho._id,
      },
      {
        patientId: 'PAT-2026-00008',
        fullName: 'Olivia Martinez',
        phone: '+1 (555) 999-0000',
        dateOfBirth: '2015-08-22',
        gender: 'FEMALE' as const,
        department: peds._id,
      },
    ];

    const patientMap = new Map<string, Types.ObjectId>();

    for (const pc of patientConfigs) {
      const normalizedPhone = normalizePhoneNumber(pc.phone);
      let patient = await PatientModel.findOne({ patientId: pc.patientId });
      if (!patient) {
        patient = await PatientModel.create({
          patientId: pc.patientId,
          fullName: pc.fullName,
          phone: pc.phone,
          normalizedPhone,
          dateOfBirth: pc.dateOfBirth,
          gender: pc.gender,
          registeredBy: primaryRegistrarId,
          registrationDepartment: pc.department,
          isActive: true,
        });
        logger.info(`Created Patient: ${pc.fullName} (${pc.patientId})`);
      } else {
        patient.fullName = pc.fullName;
        patient.phone = pc.phone;
        patient.normalizedPhone = normalizedPhone;
        patient.dateOfBirth = pc.dateOfBirth;
        patient.gender = pc.gender;
        patient.isActive = true;
        await patient.save();
        logger.info(`Updated Patient: ${pc.fullName} (${pc.patientId})`);
      }
      patientMap.set(pc.patientId, patient._id);
    }

    // Synchronize atomic Patient ID sequence counter so subsequent UI registrations start after highest seeded ID
    const currentYear = new Date().getFullYear();
    const highestSeededSeq = patientConfigs.length;
    await CounterModel.findByIdAndUpdate(
      `patient_id_${currentYear}`,
      { $max: { seq: highestSeededSeq } },
      { upsert: true, new: true },
    );
    logger.info(`Patient ID counter synchronized to at least sequence: ${highestSeededSeq}`);

    // -------------------------------------------------------------
    // 6. SAMPLE APPOINTMENTS (DIVERSE STATUSES & DATES)
    // -------------------------------------------------------------
    const dateToday = getOffsetDate(0);
    const dateTomorrow = getOffsetDate(1);
    const dateDayAfter = getOffsetDate(2);
    const dateNextWeek = getOffsetDate(5);

    const appointmentsToSeed = [
      // Cardiology: Dr. Najath
      {
        doctorId: doctorMap.get('najathmuhammad22@gmail.com')!,
        patientId: patientMap.get('PAT-2026-00001')!,
        patientName: 'Johnathan Doe',
        departmentId: cardio._id,
        date: dateToday,
        startTime: '09:00',
        endTime: '09:30',
        status: 'ARRIVED' as const,
        purpose: 'Cardiovascular checkup & ECG review',
        notes: 'Patient checked in, waiting in clinic waiting room.',
      },
      {
        doctorId: doctorMap.get('najathmuhammad22@gmail.com')!,
        patientId: patientMap.get('PAT-2026-00006')!,
        patientName: 'Sophia Garcia',
        departmentId: cardio._id,
        date: dateToday,
        startTime: '10:00',
        endTime: '10:30',
        status: 'COMPLETED' as const,
        purpose: 'Arrhythmia consultation',
        notes: 'Follow-up in 3 months. Normal sinus rhythm.',
      },
      // Cardiology: Dr. Chase
      {
        doctorId: doctorMap.get('chase@hospital.com')!,
        patientId: patientMap.get('PAT-2026-00002')!,
        patientName: 'Alice Smith',
        departmentId: cardio._id,
        date: dateTomorrow,
        startTime: '09:30',
        endTime: '10:00',
        status: 'CONFIRMED' as const,
        purpose: 'Blood pressure review and stress test',
        notes: '',
      },

      // Neurology: Dr. Jhoney
      {
        doctorId: doctorMap.get('jhoney@gmail.com')!,
        patientId: patientMap.get('PAT-2026-00002')!,
        patientName: 'Alice Smith',
        departmentId: neuro._id,
        date: dateToday,
        startTime: '11:00',
        endTime: '11:30',
        status: 'ARRIVED' as const,
        purpose: 'Migraine aura assessment',
        notes: 'Patient seated in Neuro room 2.',
      },
      {
        doctorId: doctorMap.get('jhoney@gmail.com')!,
        patientId: patientMap.get('PAT-2026-00003')!,
        patientName: 'Bob Johnson',
        departmentId: neuro._id,
        date: dateTomorrow,
        startTime: '14:00',
        endTime: '14:30',
        status: 'CONFIRMED' as const,
        purpose: 'Neuropathy follow-up',
        notes: '',
      },
      // Neurology: Dr. Foreman
      {
        doctorId: doctorMap.get('foreman@hospital.com')!,
        patientId: patientMap.get('PAT-2026-00005')!,
        patientName: 'Michael Brown',
        departmentId: neuro._id,
        date: dateDayAfter,
        startTime: '10:30',
        endTime: '11:00',
        status: 'SCHEDULED' as const,
        purpose: 'Nerve conduction study',
        notes: '',
      },

      // Orthopedics: Dr. Wilson
      {
        doctorId: doctorMap.get('wilson.ortho@hospital.com')!,
        patientId: patientMap.get('PAT-2026-00003')!,
        patientName: 'Bob Johnson',
        departmentId: ortho._id,
        date: dateToday,
        startTime: '10:00',
        endTime: '10:30',
        status: 'CONFIRMED' as const,
        purpose: 'Knee joint osteoarthritis evaluation',
        notes: 'X-rays on file.',
      },
      {
        doctorId: doctorMap.get('wilson.ortho@hospital.com')!,
        patientId: patientMap.get('PAT-2026-00007')!,
        patientName: 'William Davis',
        departmentId: ortho._id,
        date: dateTomorrow,
        startTime: '11:30',
        endTime: '12:00',
        status: 'CANCELLED' as const,
        purpose: 'Hip replacement consultation',
        notes: 'Patient requested cancellation due to family conflict.',
      },
      // Orthopedics: Dr. Torres
      {
        doctorId: doctorMap.get('torres.ortho@hospital.com')!,
        patientId: patientMap.get('PAT-2026-00008')!,
        patientName: 'Olivia Martinez',
        departmentId: ortho._id,
        date: dateDayAfter,
        startTime: '09:00',
        endTime: '09:30',
        status: 'SCHEDULED' as const,
        purpose: 'Scoliosis screening',
        notes: '',
      },

      // Pediatrics: Dr. Robbins
      {
        doctorId: doctorMap.get('robbins.peds@hospital.com')!,
        patientId: patientMap.get('PAT-2026-00008')!,
        patientName: 'Olivia Martinez',
        departmentId: peds._id,
        date: dateToday,
        startTime: '14:30',
        endTime: '15:00',
        status: 'ARRIVED' as const,
        purpose: 'Annual pediatric developmental checkup',
        notes: 'Vaccination records brought by parent.',
      },
      {
        doctorId: doctorMap.get('robbins.peds@hospital.com')!,
        patientId: patientMap.get('PAT-2026-00004')!,
        patientName: 'Emma Watson',
        departmentId: peds._id,
        date: dateTomorrow,
        startTime: '15:30',
        endTime: '16:00',
        status: 'CONFIRMED' as const,
        purpose: 'Asthma management plan',
        notes: '',
      },
      // Pediatrics: Dr. Karev
      {
        doctorId: doctorMap.get('karev.peds@hospital.com')!,
        patientId: patientMap.get('PAT-2026-00004')!,
        patientName: 'Emma Watson',
        departmentId: peds._id,
        date: dateNextWeek,
        startTime: '11:00',
        endTime: '11:30',
        status: 'SCHEDULED' as const,
        purpose: 'Allergy testing follow-up',
        notes: '',
      },

      // Dermatology: Dr. Sloan
      {
        doctorId: doctorMap.get('sloan.derm@hospital.com')!,
        patientId: patientMap.get('PAT-2026-00005')!,
        patientName: 'Michael Brown',
        departmentId: derm._id,
        date: dateToday,
        startTime: '15:00',
        endTime: '15:30',
        status: 'ARRIVED' as const,
        purpose: 'Skin lesion biopsy consultation',
        notes: '',
      },
      // Dermatology: Dr. Avery
      {
        doctorId: doctorMap.get('avery.derm@hospital.com')!,
        patientId: patientMap.get('PAT-2026-00001')!,
        patientName: 'Johnathan Doe',
        departmentId: derm._id,
        date: dateTomorrow,
        startTime: '16:00',
        endTime: '16:30',
        status: 'CONFIRMED' as const,
        purpose: 'Eczema flare-up review',
        notes: '',
      },
    ];

    for (const appt of appointmentsToSeed) {
      const existing = await AppointmentModel.findOne({
        doctor: appt.doctorId,
        date: appt.date,
        startTime: appt.startTime,
      });

      if (!existing) {
        await AppointmentModel.create({
          doctor: appt.doctorId,
          patient: appt.patientId,
          patientName: appt.patientName,
          department: appt.departmentId,
          date: appt.date,
          startTime: appt.startTime,
          endTime: appt.endTime,
          status: appt.status,
          purpose: appt.purpose,
          notes: appt.notes,
          createdBy: admin._id,
          arrivedAt: appt.status === 'ARRIVED' ? new Date() : null,
          completedAt: appt.status === 'COMPLETED' ? new Date() : null,
          cancelledAt: appt.status === 'CANCELLED' ? new Date() : null,
          cancellationReason: appt.status === 'CANCELLED' ? 'Patient requested cancellation' : '',
        });
        logger.info(`Seeded Appointment: ${appt.patientName} with Doctor on ${appt.date} at ${appt.startTime} [${appt.status}]`);
      }
    }

    logger.info('=====================================================');
    logger.info('🎉  EMR HOSPITAL DATABASE SEEDED SUCCESSFULLY!');
    logger.info('=====================================================');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    logger.error('Fatal error during hospital seeding:', {
      message: err instanceof Error ? err.message : String(err),
    });
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

void seedHospital();
