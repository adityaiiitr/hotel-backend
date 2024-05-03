// controllers/bookingController.js

const { Booking, Room } = require("../models/bookingModels");

// Book a room
exports.bookRoom = async (req, res) => {
  try {
    const { userEmail, roomNumber, startTime, endTime } = req.body;

    // Check if room is available
    const existingBooking = await Booking.findOne({
      roomNumber,
      $or: [
        { startTime: { $lt: endTime }, endTime: { $gt: startTime } },
        { startTime: { $gte: startTime, $lt: endTime } },
        { endTime: { $lte: endTime, $gt: startTime } },
      ],
    });

    if (existingBooking) {
      return res
        .status(400)
        .json({ message: "Room is not available for the specified time slot" });
    }

    // Calculate duration and price
    const duration = (endTime - startTime) / (1000 * 60 * 60); // Convert to hours
    const room = await Room.findOne({ roomNumber });
    const totalPrice = duration * room.pricePerHour;

    // Create new booking
    const booking = new Booking({
      userEmail,
      roomNumber,
      startTime,
      endTime,
      totalPrice,
    });

    await booking.save();

    res.status(201).json({ message: "Room booked successfully", booking });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Edit a booking
exports.editBooking = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { userEmail, roomNumber, startTime, endTime } = req.body;

    // Find the existing booking
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Check if the new time slot is available
    const existingBooking = await Booking.findOne({
      roomNumber,
      _id: { $ne: bookingId },
      $or: [
        { startTime: { $lt: endTime }, endTime: { $gt: startTime } },
        { startTime: { $gte: startTime, $lt: endTime } },
        { endTime: { $lte: endTime, $gt: startTime } },
      ],
    });

    if (existingBooking) {
      return res
        .status(400)
        .json({ message: "Room is not available for the specified time slot" });
    }

    // Calculate duration and price
    const duration = (endTime - startTime) / (1000 * 60 * 60); // Convert to hours
    const room = await Room.findOne({ roomNumber });
    const totalPrice = duration * room.pricePerHour;

    // Update booking details
    booking.userEmail = userEmail;
    booking.roomNumber = roomNumber;
    booking.startTime = startTime;
    booking.endTime = endTime;
    booking.totalPrice = totalPrice;

    await booking.save();

    res.status(200).json({ message: "Booking updated successfully", booking });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Cancel a booking
exports.cancelBooking = async (req, res) => {
  try {
    const bookingId = req.params.id;

    // Find the booking by ID
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Calculate time difference in milliseconds
    const currentTime = new Date();
    const timeDifference = booking.startTime - currentTime;

    // Define cancellation policy thresholds
    const within24Hours = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const within48Hours = 48 * 60 * 60 * 1000; // 48 hours in milliseconds

    let refundAmount = 0;

    if (timeDifference > within48Hours) {
      // Full refund if more than 48 hours left
      refundAmount = booking.totalPrice;
    } else if (timeDifference > within24Hours) {
      // 50% refund if between 24 and 48 hours left
      refundAmount = booking.totalPrice / 2;
    }

    // Update booking status and refund amount
    booking.status = "cancelled";
    booking.refundAmount = refundAmount;

    await booking.save();

    res
      .status(200)
      .json({ message: "Booking cancelled successfully", refundAmount });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// View all bookings
exports.viewBookings = async (req, res) => {
  try {
    const { roomNumber, roomType, startTime, endTime } = req.query;

    // Construct query object based on provided filters
    const query = {};
    if (roomNumber) {
      query.roomNumber = roomNumber;
    }
    if (roomType) {
      query.roomType = roomType;
    }
    if (startTime && endTime) {
      query.startTime = { $gte: new Date(startTime), $lte: new Date(endTime) };
    }

    // Find bookings based on filters
    const bookings = await Booking.find(query);

    res.status(200).json({ bookings });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
